import AppKit
import Darwin
import OSLog
import WebKit

private enum LaunchError: LocalizedError {
    case usage, alreadyOpen, missingBundle, aiConfiguration, workerConfiguration

    var errorDescription: String? {
        switch self {
        case .usage: return "서버 모드에는 --server와 HTTPS 주소를 지정해 주세요."
        case .alreadyOpen: return "이 Mac에서 아맞다가 이미 실행 중입니다."
        case .missingBundle: return "앱 번들에 Node 또는 서버 파일이 없습니다. 다시 빌드해 주세요."
        case .aiConfiguration: return "ai.json의 provider를 off 또는 ollama로 설정해 주세요. model에는 설치한 로컬 모델 이름만 지정할 수 있어요."
        case .workerConfiguration: return "worker.env에 작업공간 ID와 일꾼 토큰을 적고 권한을 600으로 설정해 주세요."
        }
    }
}

private enum Mode {
    case local, remote(URL)

    init(arguments: [String]) throws {
        let args = arguments.filter { !$0.hasPrefix("-psn_") }
        if args.isEmpty {
            self = .local
            return
        }
        guard args.count == 2, args[0] == "--server",
              let address = URLComponents(string: args[1]),
              address.scheme?.lowercased() == "https",
              let host = address.host, !host.isEmpty,
              address.user == nil, address.password == nil,
              address.path.isEmpty || address.path == "/",
              address.query == nil, address.fragment == nil,
              let url = address.url else { throw LaunchError.usage }
        self = .remote(url)
    }
}

private struct AIConfiguration: Decodable {
    let provider: String
    let model: String?

    static func environment(in storage: URL) throws -> [String: String] {
        let file = storage.appendingPathComponent("ai.json")
        guard FileManager.default.fileExists(atPath: file.path) else {
            return ["AI_PROVIDER": "ollama", "OLLAMA_MODEL": "qwen3:4b"]
        }
        guard let data = try? Data(contentsOf: file),
              let config = try? JSONDecoder().decode(AIConfiguration.self, from: data) else {
            throw LaunchError.aiConfiguration
        }
        if config.provider == "off" { return ["AI_PROVIDER": "off"] }
        let name = config.model ?? "qwen3:4b"
        guard config.provider == "ollama", name.count <= 128,
              name.range(of: #"\A(?:[a-z0-9][a-z0-9_-]*/)?[a-z0-9][a-z0-9_.-]*(?::[a-z0-9][a-z0-9_.-]*)?\z"#,
                         options: [.regularExpression, .caseInsensitive]) != nil,
              name.range(of: #"(?:^|[/:._-])cloud(?:$|[/:._-])"#,
                         options: [.regularExpression, .caseInsensitive]) == nil else {
            throw LaunchError.aiConfiguration
        }
        return ["AI_PROVIDER": "ollama", "OLLAMA_MODEL": name]
    }
}

private final class Ahmatda: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let local = URL(string: "http://127.0.0.1:5601/")!
    private let files = FileManager.default
    private let logger = Logger(subsystem: "org.ininhyeop.t07.ahmatda", category: "launcher")
    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.connectionProxyDictionary = [:]
        config.timeoutIntervalForRequest = 1
        return URLSession(configuration: config)
    }()
    private var window: NSWindow!
    private var status: NSTextField!
    private var webView: WKWebView?
    private var origin: URL?
    private var localStorage: URL?
    private var lock: Int32 = -1
    private var child: Process?
    private var childInput: Pipe?
    private var childOutput: Pipe?
    private var startupOutput = Data()
    private var childReady = false
    private var failed = false
    private var closing = false
    private var preparationShown = false
    private var preparationAlert: NSAlert?
    private var aiEnvironment: [String: String] = [:]
    private let probeDelegate = LocalProbeDelegate()
    private var probeSession: URLSession?

    func applicationDidFinishLaunching(_ notification: Notification) {
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 800),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "아맞다"
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 400, height: 500)
        status = NSTextField(wrappingLabelWithString: "아맞다를 시작하고 있어요…")
        status.alignment = .center
        status.frame = window.contentView!.bounds.insetBy(dx: 28, dy: 28)
        status.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(status)
        window.center()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        do {
            switch try Mode(arguments: Array(CommandLine.arguments.dropFirst())) {
            case .local:
                origin = local
                window.title = "아맞다 · 이 Mac"
                installMenu(localMode: true)
                try startLocalServer()
            case let .remote(url):
                origin = url
                window.title = "아맞다 · 서버 · \(url.host ?? "")"
                installMenu(localMode: false)
                showWebView(localRules: nil)
            }
        } catch {
            fail(error.localizedDescription)
        }
    }

    private func startLocalServer() throws {
        let storage = try files.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                    appropriateFor: nil, create: true)
            .appendingPathComponent("Ahmatda", isDirectory: true)
        try files.createDirectory(at: storage, withIntermediateDirectories: true,
                                  attributes: [.posixPermissions: 0o700])
        try files.setAttributes([.posixPermissions: 0o700], ofItemAtPath: storage.path)
        localStorage = storage
        let fd = Darwin.open(storage.appendingPathComponent("launcher.lock").path,
                             O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, 0o600)
        guard fd >= 0 else { throw CocoaError(.fileWriteNoPermission) }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else {
            Darwin.close(fd)
            throw LaunchError.alreadyOpen
        }
        lock = fd

        guard let resources = Bundle.main.resourceURL,
              let executable = Bundle.main.url(forAuxiliaryExecutable: "node") else { throw LaunchError.missingBundle }
        let app = resources.appendingPathComponent("app", isDirectory: true)
        let server = app.appendingPathComponent("server.mjs")
        let bootstrap = resources.appendingPathComponent("parent-lifetime.mjs")
        guard files.isExecutableFile(atPath: executable.path), files.isReadableFile(atPath: server.path),
              files.isReadableFile(atPath: bootstrap.path) else { throw LaunchError.missingBundle }

        let proc = Process()
        proc.executableURL = executable
        proc.arguments = ["--import", bootstrap.path, server.path]
        proc.currentDirectoryURL = app
        var env = [
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            "HOME": files.homeDirectoryForCurrentUser.path,
            "HOST": "127.0.0.1", "PORT": "5601", "PUBLIC_BASE_URL": "http://127.0.0.1:5601",
            "DATA_DIR": storage.appendingPathComponent("data", isDirectory: true).path,
            "DEMO_MODE": "0", "TRUST_PROXY": "0", "AUTH_MAIL_MODE": "outbox",
            "ALLOW_PAID_AI": "0", "ANTHROPIC_API_KEY": "",
            "FFMPEG_PATH": "ffmpeg", "FFPROBE_PATH": "ffprobe",
        ]
        aiEnvironment = try AIConfiguration.environment(in: storage)
        env.merge(aiEnvironment) { _, localValue in localValue }
        env.merge(try workerEnvironment(in: storage)) { _, localValue in localValue }
        proc.environment = env

        let input = Pipe()
        let output = Pipe()
        proc.standardInput = input
        proc.standardOutput = output
        proc.standardError = output
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty {
                handle.readabilityHandler = nil
                return
            }
            DispatchQueue.main.async { self?.receiveStartupOutput(data) }
        }
        proc.terminationHandler = { [weak self] process in
            let code = process.terminationStatus
            DispatchQueue.main.async {
                guard let self, !self.closing, !self.failed else { return }
                self.logger.error("Node exited with status \(code, privacy: .public)")
                self.fail("로컬 서버가 종료됐어요. 다른 프로그램이 5601 포트를 사용 중인지 확인한 뒤 앱을 다시 열어 주세요.")
            }
        }
        child = proc
        childInput = input
        childOutput = output
        try proc.run()
        logger.notice("Started local Node process")
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, self.webView == nil, !self.closing, !self.failed else { return }
            self.fail("로컬 서버를 확인할 수 없어요. 앱을 다시 실행해 주세요.")
        }
    }

    private func workerEnvironment(in storage: URL) throws -> [String: String] {
        let file = storage.appendingPathComponent("worker.env")
        guard files.fileExists(atPath: file.path) else { return [:] }
        let attributes = try files.attributesOfItem(atPath: file.path)
        guard attributes[.type] as? FileAttributeType == .typeRegular,
              (attributes[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(),
              let permissions = (attributes[.posixPermissions] as? NSNumber)?.intValue,
              (permissions & 0o077) == 0,
              let size = (attributes[.size] as? NSNumber)?.intValue, size <= 4096 else {
            throw LaunchError.workerConfiguration
        }
        var fields: [String: String] = [:]
        for raw in try String(contentsOf: file, encoding: .utf8).split(whereSeparator: \.isNewline) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("#") { continue }
            let pair = line.split(separator: "=", maxSplits: 1)
            guard pair.count == 2, ["WORKER_WORKSPACE_ID", "WORKER_TOKEN"].contains(String(pair[0])),
                  fields[String(pair[0])] == nil else { throw LaunchError.workerConfiguration }
            fields[String(pair[0])] = String(pair[1])
        }
        guard fields["WORKER_WORKSPACE_ID"]?.range(of: "^ws_[a-z0-9]{19}$", options: .regularExpression) != nil,
              fields["WORKER_TOKEN"]?.range(of: "^[A-Za-z0-9_-]{32,128}$", options: .regularExpression) != nil else {
            throw LaunchError.workerConfiguration
        }
        return fields
    }

    private func receiveStartupOutput(_ data: Data) {
        // 서버의 준비 신호만 확인한다. stdout/stderr의 개인 데이터와 토큰은 로그에 남기지 않는다.
        guard !childReady, !failed, !closing else { return }
        startupOutput.append(data)
        let marker = Data("[callnote] http://127.0.0.1:5601 · commit ".utf8)
        if startupOutput.range(of: marker) != nil {
            childReady = true
            startupOutput.removeAll()
            checkHealth()
        } else if startupOutput.count > 8192 {
            startupOutput = Data(startupOutput.suffix(marker.count))
        }
    }

    private func checkHealth() {
        guard child?.isRunning == true, !closing, !failed else { return }
        let healthURL = local.appendingPathComponent("healthz")
        session.dataTask(with: healthURL) { [weak self] data, response, _ in
            let body = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            let ready = (response as? HTTPURLResponse)?.statusCode == 200 &&
                response?.url == healthURL && body?["ok"] as? Bool == true
            DispatchQueue.main.async {
                guard let self, self.child?.isRunning == true, !self.closing, !self.failed else { return }
                if ready {
                    self.logger.notice("Local health check succeeded")
                    self.prepareLocalWebView()
                } else {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in self?.checkHealth() }
                }
            }
        }.resume()
    }

    private func prepareLocalWebView() {
        // 기존 웹 UI의 폰트 CDN 요청도 로컬 모드에서 차단한다.
        let rules = #"[{"trigger":{"url-filter":"^https?://","unless-domain":["127.0.0.1"]},"action":{"type":"block"}}]"#
        WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "AhmatdaLocal-v1", encodedContentRuleList: rules) {
            [weak self] ruleList, _ in
            DispatchQueue.main.async {
                guard let self, !self.closing, !self.failed else { return }
                guard let ruleList else {
                    self.fail("로컬 화면의 연결 제한을 설정할 수 없어요. 앱을 다시 열어 주세요.")
                    return
                }
                self.showWebView(localRules: ruleList)
            }
        }
    }

    private func showWebView(localRules: WKContentRuleList?) {
        guard let origin else { return }
        let config = WKWebViewConfiguration()
        if let localRules {
            config.userContentController.add(localRules)
        } else {
            config.websiteDataStore = .nonPersistent()
        }
        let view = WKWebView(frame: window.contentView!.bounds, configuration: config)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        window.contentView = view
        webView = view
        view.load(URLRequest(url: origin))
    }

    private func allows(_ url: URL?) -> Bool {
        guard let url, let origin else { return false }
        return url.scheme?.lowercased() == origin.scheme?.lowercased() &&
            url.host?.lowercased() == origin.host?.lowercased() &&
            (url.port ?? 443) == (origin.port ?? 443) && url.user == nil && url.password == nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard allows(action.request.url) else { decisionHandler(.cancel); return }
        if action.shouldPerformDownload { decisionHandler(.download); return }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard allows(response.response.url) else { decisionHandler(.cancel); return }
        decisionHandler(response.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if allows(action.request.url) { webView.load(action.request) }
        return nil
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor @Sendable ([URL]?) -> Void) {
        let frameOrigin = frame.securityOrigin
        let framePort = frameOrigin.port == 0 ? 443 : frameOrigin.port
        guard webView === self.webView, let origin,
              frameOrigin.protocol.lowercased() == origin.scheme?.lowercased(),
              frameOrigin.host.lowercased() == origin.host?.lowercased(),
              framePort == (origin.port ?? 443) else {
            completionHandler(nil)
            return
        }

        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { answer in completionHandler(answer == .OK ? panel.urls : nil) }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        guard allows(response.url) else { completionHandler(nil); return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = (suggestedFilename as NSString).lastPathComponent
        panel.beginSheetModal(for: window) { answer in completionHandler(answer == .OK ? panel.url : nil) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard !failed, !closing, (error as NSError).code != NSURLErrorCancelled else { return }
        let alert = NSAlert()
        alert.messageText = "화면을 열 수 없어요."
        alert.informativeText = "연결 상태를 확인하고 ⌘R로 다시 시도해 주세요."
        alert.beginSheetModal(for: window)
    }

    private func installMenu(localMode: Bool) {
        let menu = NSMenu()
        func addMenu(_ title: String, _ items: [NSMenuItem]) {
            let top = NSMenuItem()
            let submenu = NSMenu(title: title)
            items.forEach { submenu.addItem($0) }
            top.submenu = submenu
            menu.addItem(top)
        }
        func command(_ title: String, _ action: Selector, _ key: String = "") -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.target = self
            return item
        }
        addMenu("아맞다", [NSMenuItem(title: "아맞다 종료", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")])
        var navigation = [command("링크 열기…", #selector(openLink), "l"), command("새로고침", #selector(reload), "r")]
        if localMode {
            navigation.append(command("로컬 AI 준비 상태…", #selector(showPreparation)))
            navigation.append(command("로컬 자료 폴더 열기", #selector(revealStorage)))
        }
        addMenu("이동", navigation)
        addMenu("편집", [
            NSMenuItem(title: "잘라내기", action: #selector(NSText.cut(_:)), keyEquivalent: "x"),
            NSMenuItem(title: "복사", action: #selector(NSText.copy(_:)), keyEquivalent: "c"),
            NSMenuItem(title: "붙여넣기", action: #selector(NSText.paste(_:)), keyEquivalent: "v"),
            NSMenuItem(title: "전체 선택", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a"),
        ])
        NSApp.mainMenu = menu
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        guard localStorage != nil, !preparationShown else { return }
        preparationShown = true
        showPreparation()
    }

    @objc private func showPreparation() {
        guard localStorage != nil, preparationAlert == nil, !closing else { return }
        let alert = NSAlert()
        preparationAlert = alert
        alert.messageText = "이 Mac의 AI 준비 상태"
        alert.informativeText = "로컬 모델 연결을 확인하고 있어요…"
        alert.addButton(withTitle: "수동 업무 계속")
        alert.addButton(withTitle: "다시 확인")
        alert.addButton(withTitle: "모델 준비 안내")
        alert.beginSheetModal(for: window) { [weak self] answer in
            guard let self else { return }
            self.probeSession?.invalidateAndCancel()
            self.probeSession = nil
            self.preparationAlert = nil
            if answer == .alertSecondButtonReturn { self.showPreparation() }
            if answer == .alertThirdButtonReturn { self.showPreparationGuide() }
        }
        let common = "\n\n받아쓰기: 상태 미검증. 별도 일꾼이 필요하며 이 화면에서는 전사를 시험하지 않아요.\n유료 AI는 꺼져 있고, 녹음이나 원문은 외부로 보내지 않아요."
        if aiEnvironment["AI_PROVIDER"] == "off" {
            alert.informativeText = "주문 정리 AI: 꺼짐. 수동 업무만 사용하도록 설정되어 있어요." + common
            return
        }
        let config = URLSessionConfiguration.ephemeral
        config.connectionProxyDictionary = [:]
        config.timeoutIntervalForRequest = 3
        config.timeoutIntervalForResource = 3
        let probe = URLSession(configuration: config, delegate: probeDelegate, delegateQueue: nil)
        probeSession = probe
        let model = aiEnvironment["OLLAMA_MODEL"] ?? "qwen3:4b"
        probe.dataTask(with: URL(string: "http://127.0.0.1:11434/api/tags")!) { [weak self, weak alert] data, response, _ in
            let message = LocalModelStatus.message(data: data, statusCode: (response as? HTTPURLResponse)?.statusCode, model: model)
            DispatchQueue.main.async {
                guard let self, let alert, self.preparationAlert === alert else { return }
                alert.informativeText = message + common
            }
        }.resume()
    }

    private func showPreparationGuide() {
        let alert = NSAlert()
        alert.messageText = "모델을 자동으로 내려받지 않아요"
        alert.informativeText = "현재는 개발 검증용 앱이에요.\n\n1. 공식 Ollama를 준비하고 로컬 서버를 실행해요.\n2. 설정된 모델을 준비해요: \(aiEnvironment["OLLAMA_MODEL"] ?? "qwen3:4b")\n3. 이동 → 로컬 AI 준비 상태에서 다시 확인해요.\n\n음성 받아쓰기는 faster-whisper 일꾼이 별도로 필요해요. 모델 다운로드·자동 설치 기능은 아직 없어요.\n계정 가입 후 인증 링크는 이동 → 로컬 자료 폴더 열기의 data/outbox에 저장돼요."
        alert.addButton(withTitle: "확인")
        alert.beginSheetModal(for: window)
    }

    @objc private func openLink() {
        guard let webView else { return }
        let prompt = NSAlert()
        prompt.messageText = "아맞다 링크 열기"
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 360, height: 24))
        prompt.accessoryView = field
        prompt.window.initialFirstResponder = field
        prompt.addButton(withTitle: "열기")
        prompt.addButton(withTitle: "취소")
        prompt.beginSheetModal(for: window) { [weak self] answer in
            guard answer == .alertFirstButtonReturn,
                  let url = URL(string: field.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)),
                  self?.allows(url) == true else { return }
            webView.load(URLRequest(url: url))
        }
    }

    @objc private func reload() {
        guard let webView, let origin else { return }
        if webView.reload() == nil { webView.load(URLRequest(url: origin)) }
    }

    @objc private func revealStorage() {
        if let localStorage { NSWorkspace.shared.open(localStorage) }
    }

    private func fail(_ message: String) {
        failed = true
        logger.error("Launcher stopped with an error")
        stopChild()
        window.contentView = NSView(frame: window.contentLayoutRect)
        status.frame = window.contentView!.bounds.insetBy(dx: 28, dy: 28)
        status.stringValue = message
        window.contentView?.addSubview(status)
        webView = nil
    }

    private func stopChild() {
        childOutput?.fileHandleForReading.readabilityHandler = nil
        try? childInput?.fileHandleForWriting.close()
        if let child, child.isRunning { child.terminate() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        closing = true
        probeSession?.invalidateAndCancel()
        stopChild()
        if let child, child.isRunning { child.waitUntilExit() }
        if lock >= 0 { Darwin.close(lock) }
    }
}

@main
private enum AhmatdaMain {
    static func main() {
        let app = NSApplication.shared
        let delegate = Ahmatda()
        app.delegate = delegate
        app.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { app.run() }
    }
}
