import AppKit
import Darwin
import OSLog
import WebKit
import Security

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
    private var gettingStartedAlert: NSAlert?
    private var gettingStartedChoice: NSPopUpButton?
    private var gettingStartedDetail: NSTextField?
    private var preparationAlert: NSAlert?
    private var aiEnvironment: [String: String] = [:]
    private let probeDelegate = LocalProbeDelegate()
    private var probeSession: URLSession?
    private var modelSetupProcess: Process?
    private var modelSetupOutput: Pipe?
    private var modelSetupBuffer = Data()
    private var modelSetupAlert: NSAlert?
    private var modelSetupFinished = false
    private var runtimeProcess: Process?
    private var runtimeInput: Pipe?
    private var runtimeOutput: Pipe?
    private var runtimeBuffer = Data()
    private var runtimeReady = false
    private var runtimeCompletion: ((Bool) -> Void)?
    private var runtimeNotice = ""
    private var workerCapability = ""
    private var whisperWorkerProcess: Process?
    private var whisperWorkerInput: Pipe?
    private var whisperWorkerOutput: Pipe?
    private var whisperWorkerBuffer = Data()
    private var whisperWorkerNotice = "받아쓰기 연결 설정에서 작업공간을 연결해 주세요."

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
        let profileURL = Bundle.main.resourceURL?.appendingPathComponent("whisper-runtime-profile.json")
        let profileData: Data?
        if let profileURL, files.fileExists(atPath: profileURL.path) {
            let values = try profileURL.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true,
                  (values.fileSize ?? 1024) < 1024 else { throw LaunchError.missingBundle }
            profileData = try Data(contentsOf: profileURL)
        } else { profileData = nil }
        let storageName = try LocalDevelopmentProfile.storageName(
            info: Bundle.main.object(forInfoDictionaryKey: "AhmatdaDevelopmentProfile"), data: profileData)
        if storageName != "Ahmatda" { window.title = "아맞다 · PyAV 개발 테스트 · 별도 자료" }
        let storage = try files.url(for: .applicationSupportDirectory, in: .userDomainMask,
                                    appropriateFor: nil, create: true)
            .appendingPathComponent(storageName, isDirectory: true)
        try files.createDirectory(at: storage, withIntermediateDirectories: true,
                                  attributes: [.posixPermissions: 0o700])
        try files.setAttributes([.posixPermissions: 0o700], ofItemAtPath: storage.path)
        localStorage = storage
        let dataDirectory = storage.appendingPathComponent("data", isDirectory: true)
        try files.createDirectory(at: dataDirectory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        let dataAttributes = try files.attributesOfItem(atPath: dataDirectory.path)
        guard dataAttributes[.type] as? FileAttributeType == .typeDirectory,
              (dataAttributes[.ownerAccountID] as? NSNumber)?.uint32Value == getuid() else { throw LaunchError.workerConfiguration }
        try files.setAttributes([.posixPermissions: 0o700], ofItemAtPath: dataDirectory.path)
        let fd = Darwin.open(storage.appendingPathComponent("launcher.lock").path,
                             O_CREAT | O_RDWR | O_CLOEXEC | O_NOFOLLOW, 0o600)
        guard fd >= 0 else { throw CocoaError(.fileWriteNoPermission) }
        guard flock(fd, LOCK_EX | LOCK_NB) == 0 else {
            Darwin.close(fd)
            throw LaunchError.alreadyOpen
        }
        lock = fd
        workerCapability = try localWorkerCapability(in: storage)

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
        let audioRuntime = resources.appendingPathComponent("runtime/ffmpeg-audio-9.0.2", isDirectory: true)
        let audioBundled = files.fileExists(atPath: audioRuntime.path)
        let ffmpeg = audioRuntime.appendingPathComponent("bin/ffmpeg")
        let ffprobe = audioRuntime.appendingPathComponent("bin/ffprobe")
        if audioBundled && (!files.isExecutableFile(atPath: ffmpeg.path) || !files.isExecutableFile(atPath: ffprobe.path)) {
            throw LaunchError.missingBundle
        }
        var env = [
            "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
            "HOME": files.homeDirectoryForCurrentUser.path,
            "HOST": "127.0.0.1", "PORT": "5601", "PUBLIC_BASE_URL": "http://127.0.0.1:5601",
            "DATA_DIR": storage.appendingPathComponent("data", isDirectory: true).path,
            "DEMO_MODE": "0", "TRUST_PROXY": "0", "AUTH_MAIL_MODE": "outbox",
            "AHMATDA_LOCAL_MAC": "1", "AHMATDA_LOCAL_WORKER_CAPABILITY": workerCapability,
            "ALLOW_PAID_AI": "0", "ANTHROPIC_API_KEY": "", "AHMATDA_OLLAMA_PORT": "11435",
            "FFMPEG_PATH": audioBundled ? ffmpeg.path : "ffmpeg",
            "FFPROBE_PATH": audioBundled ? ffprobe.path : "ffprobe",
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
        if aiEnvironment["AI_PROVIDER"] == "ollama" {
            startManagedRuntime { [weak self] ready in
                guard let self, !self.closing else { return }
                if !ready {
                    var safe = proc.environment ?? [:]
                    safe["AI_PROVIDER"] = "off"
                    proc.environment = safe
                    self.aiEnvironment["AI_PROVIDER"] = "off"
                }
                do { try self.launchLocalNode(proc) }
                catch { self.fail("로컬 업무 서버를 시작할 수 없어요. 앱을 다시 열어 주세요.") }
            }
        } else { try launchLocalNode(proc) }
    }

    private func launchLocalNode(_ process: Process) throws {
        try process.run()
        logger.notice("Started local Node process")
        DispatchQueue.main.asyncAfter(deadline: .now() + 20) { [weak self] in
            guard let self, self.webView == nil, !self.closing, !self.failed else { return }
            self.fail("로컬 서버를 확인할 수 없어요. 앱을 다시 실행해 주세요.")
        }
    }

    private func startManagedRuntime(completion: @escaping (Bool) -> Void) {
        guard let resources = Bundle.main.resourceURL,
              let executable = Bundle.main.url(forAuxiliaryExecutable: "node") else { completion(false); return }
        status.stringValue = "로컬 AI 실행기를 확인하고 있어요…"
        runtimeCompletion = completion
        let process = Process()
        let input = Pipe(), output = Pipe()
        process.executableURL = executable
        process.arguments = [resources.appendingPathComponent("local-runtime.mjs").path, "--start"]
        process.environment = ["HOME": files.homeDirectoryForCurrentUser.path,
                               "PATH": "/usr/bin:/bin:/usr/sbin:/sbin"]
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        runtimeProcess = process
        runtimeInput = input
        runtimeOutput = output
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receiveRuntime(data) }
        }
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, !self.closing, !self.failed else { return }
                if self.runtimeReady {
                    self.fail("앱 전용 AI 실행기가 종료되어 업무 서버를 안전하게 멈췄어요. 앱을 다시 열어 주세요.")
                } else {
                    self.runtimeNotice = "실행기를 시작하지 못해 이번에는 수동 업무로 시작했어요. 앱 전용 실행기와 11435 포트를 확인해 주세요."
                    self.finishRuntimeStartup(false)
                }
            }
        }
        do { try process.run() }
        catch {
            output.fileHandleForReading.readabilityHandler = nil
            runtimeNotice = "앱 전용 실행기를 찾지 못해 수동 업무로 시작했어요."
            finishRuntimeStartup(false)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
            guard let self, self.runtimeCompletion != nil, !self.closing else { return }
            self.stopManagedRuntime()
            self.runtimeNotice = "실행기 확인 시간이 지나 수동 업무로 시작했어요."
            self.finishRuntimeStartup(false)
        }
    }

    private func finishRuntimeStartup(_ ready: Bool) {
        guard let completion = runtimeCompletion else { return }
        runtimeCompletion = nil
        runtimeReady = ready
        completion(ready)
    }

    private func receiveRuntime(_ data: Data) {
        runtimeBuffer.append(data)
        guard runtimeBuffer.count < 65536 else { stopManagedRuntime(); finishRuntimeStartup(false); return }
        while let end = runtimeBuffer.firstIndex(of: 10) {
            let line = runtimeBuffer.prefix(upTo: end)
            runtimeBuffer.removeSubrange(...end)
            guard let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  let event = value["event"] as? String else { continue }
            if event == "ready" { finishRuntimeStartup(true) }
            if event == "error" {
                runtimeNotice = "앱 전용 AI 실행기를 준비하지 못해 수동 업무로 시작했어요. 기존의 다른 모델 서버는 변경하지 않았어요."
                if runtimeReady { fail("앱 전용 AI 실행기 오류로 업무 서버를 멈췄어요. 앱을 다시 열어 주세요.") }
                else { finishRuntimeStartup(false) }
            }
        }
    }

    private func stopManagedRuntime() {
        try? runtimeInput?.fileHandleForWriting.close()
        if let runtimeProcess, runtimeProcess.isRunning { runtimeProcess.terminate() }
    }

    // Stable app capability is never exposed to the browser, command arguments or logs.
    private func localWorkerCapability(in storage: URL) throws -> String {
        let path = storage.appendingPathComponent("local-worker.capability").path
        var descriptor = Darwin.open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
        if descriptor < 0 && errno == ENOENT {
            var bytes = [UInt8](repeating: 0, count: 32)
            guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw LaunchError.workerConfiguration }
            let value = bytes.map { String(format: "%02x", $0) }.joined()
            descriptor = Darwin.open(path, O_CREAT | O_EXCL | O_WRONLY | O_CLOEXEC | O_NOFOLLOW, 0o600)
            guard descriptor >= 0 else { throw LaunchError.workerConfiguration }
            let count = value.withCString { Darwin.write(descriptor, $0, 64) }
            let synced = Darwin.fsync(descriptor)
            Darwin.close(descriptor)
            guard count == 64, synced == 0 else { throw LaunchError.workerConfiguration }
            descriptor = Darwin.open(path, O_RDONLY | O_CLOEXEC | O_NOFOLLOW)
        }
        guard descriptor >= 0 else { throw LaunchError.workerConfiguration }
        defer { Darwin.close(descriptor) }
        var info = stat()
        guard fstat(descriptor, &info) == 0, (info.st_mode & S_IFMT) == S_IFREG,
              info.st_uid == getuid(), (info.st_mode & 0o077) == 0, info.st_size == 64 else { throw LaunchError.workerConfiguration }
        var bytes = [UInt8](repeating: 0, count: 65)
        guard Darwin.read(descriptor, &bytes, 65) == 64,
              let value = String(bytes: bytes.prefix(64), encoding: .utf8),
              value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else { throw LaunchError.workerConfiguration }
        return value
    }

    private func startWhisperWorker() {
        guard whisperWorkerProcess == nil, child?.isRunning == true, !closing, !failed,
              !workerCapability.isEmpty, let resources = Bundle.main.resourceURL,
              let executable = Bundle.main.url(forAuxiliaryExecutable: "node") else { return }
        let helper = resources.appendingPathComponent("whisper-worker.mjs")
        guard files.isReadableFile(atPath: helper.path) else {
            whisperWorkerNotice = "받아쓰기 실행기가 앱에 없습니다. 앱을 업데이트해 주세요."
            return
        }
        let process = Process()
        process.executableURL = executable
        process.arguments = [helper.path, "--start"]
        process.environment = ["HOME": files.homeDirectoryForCurrentUser.path,
            "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
            "AHMATDA_LOCAL_WORKER_CAPABILITY": workerCapability]
        let input = Pipe(), output = Pipe()
        process.standardInput = input
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        // Only predefined event labels enter the UI; no arbitrary subprocess text is logged.
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receiveWhisperWorkerOutput(data) }
        }
        process.terminationHandler = { [weak self] _ in
            DispatchQueue.main.async {
                guard let self, !self.closing else { return }
                self.whisperWorkerNotice = "받아쓰기 실행기가 멈췄어요. 앱을 다시 열고 연결 상태를 확인해 주세요."
            }
        }
        whisperWorkerProcess = process
        whisperWorkerInput = input
        whisperWorkerOutput = output
        do { try process.run() }
        catch {
            whisperWorkerProcess = nil
            whisperWorkerNotice = "받아쓰기 실행기를 시작하지 못했어요. 앱을 다시 열어 주세요."
        }
    }

    private func receiveWhisperWorkerOutput(_ data: Data) {
        whisperWorkerBuffer.append(data)
        guard whisperWorkerBuffer.count < 65536 else { stopWhisperWorker(); return }
        while let end = whisperWorkerBuffer.firstIndex(of: 10) {
            let line = whisperWorkerBuffer.prefix(upTo: end)
            whisperWorkerBuffer.removeSubrange(...end)
            guard let object = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  let event = object["event"] as? String else { continue }
            switch event {
            case "starting": whisperWorkerNotice = "받아쓰기 실행기를 시작하고 있어요."
            case "running": whisperWorkerNotice = "받아쓰기 일꾼 실행 중. 실제 전사 성공은 통화 처리 결과에서 확인하세요."
            case "waiting":
                switch object["reason"] as? String {
                case "model_missing": whisperWorkerNotice = "받아쓰기 모델 준비 메뉴에서 모델을 준비해 주세요."
                case "runtime_missing": whisperWorkerNotice = "받아쓰기 실행기를 준비해 주세요."
                case "authorization_failed": whisperWorkerNotice = "작업공간의 연결 승인이 만료되거나 해제됐어요. 연결 설정을 확인해 주세요."
                default: whisperWorkerNotice = "받아쓰기 연결 설정에서 작업공간을 연결해 주세요."
                }
            case "error": whisperWorkerNotice = "받아쓰기 실행기를 확인하지 못했어요. 모델 준비와 연결 설정을 확인해 주세요."
            default: break
            }
        }
    }

    private func stopWhisperWorker() {
        try? whisperWorkerInput?.fileHandleForWriting.close()
        if let whisperWorkerProcess, whisperWorkerProcess.isRunning { whisperWorkerProcess.terminate() }
    }

    @objc private func openWorkerSettings() {
        guard localStorage != nil else { return }
        webView?.load(URLRequest(url: URL(string: "http://127.0.0.1:5601/#/settings/integrations")!))
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
                    self.startWhisperWorker()
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
            navigation.append(command("이 Mac에서 시작…", #selector(showGettingStarted)))
            navigation.append(command("이 Mac 점검…", #selector(showMacPreflight)))
            navigation.append(command("로컬 AI 준비 상태…", #selector(showPreparation)))
            navigation.append(command("주문 정리 모델 준비…", #selector(confirmModelPreparation)))
            navigation.append(command("받아쓰기 모델 준비…", #selector(confirmWhisperPreparation)))
            navigation.append(command("받아쓰기 연결 설정…", #selector(openWorkerSettings)))
            navigation.append(command("로컬 가입 인증 링크 열기…", #selector(openLocalVerification)))
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
        alert.addButton(withTitle: "이 Mac에서 시작")
        alert.beginSheetModal(for: window) { [weak self] answer in
            guard let self else { return }
            self.probeSession?.invalidateAndCancel()
            self.probeSession = nil
            self.preparationAlert = nil
            if answer == .alertSecondButtonReturn { self.showPreparation() }
            if answer == .alertThirdButtonReturn { DispatchQueue.main.async { [weak self] in self?.showPreparationGuide() } }
        }
        let common = "\n\n받아쓰기: " + whisperWorkerNotice + "\n이 화면에서는 실제 전사를 시험하지 않아요. 유료 AI는 꺼져 있고, 녹음이나 원문은 외부로 보내지 않아요."
        if aiEnvironment["AI_PROVIDER"] == "off" {
            alert.informativeText = "주문 정리 AI: 꺼짐. 수동 업무만 사용하도록 설정되어 있어요.\n" + runtimeNotice + common
            return
        }
        let config = URLSessionConfiguration.ephemeral
        config.connectionProxyDictionary = [:]
        config.timeoutIntervalForRequest = 3
        config.timeoutIntervalForResource = 3
        let probe = URLSession(configuration: config, delegate: probeDelegate, delegateQueue: nil)
        probeSession = probe
        let model = aiEnvironment["OLLAMA_MODEL"] ?? "qwen3:4b"
        probe.dataTask(with: URL(string: "http://127.0.0.1:11435/api/tags")!) { [weak self, weak alert] data, response, _ in
            let message = LocalModelStatus.message(data: data, statusCode: (response as? HTTPURLResponse)?.statusCode, model: model)
            DispatchQueue.main.async {
                guard let self, let alert, self.preparationAlert === alert else { return }
                alert.informativeText = message + common
            }
        }.resume()
    }

    private func showPreparationGuide() { showGettingStarted() }

    @objc private func showMacPreflight() {
        guard let storage = localStorage, !closing, !failed, window.attachedSheet == nil else { return }
        let version = ProcessInfo.processInfo.operatingSystemVersion
        var system = utsname()
        let architecture: String?
        if uname(&system) == 0 {
            architecture = withUnsafeBytes(of: &system.machine) { bytes in
                String(bytes: bytes.prefix { $0 != 0 }, encoding: .utf8)
            }
        } else { architecture = nil }
        let attributes = try? files.attributesOfFileSystem(forPath: storage.path)
        let free = (attributes?[.systemFreeSize] as? NSNumber).flatMap { $0.int64Value >= 0 ? $0.uint64Value : nil }
        let memory = ProcessInfo.processInfo.physicalMemory
        let alert = NSAlert()
        alert.messageText = "이 Mac 점검 · 읽기 전용"
        alert.informativeText = LocalMacPreflight.report(
            os: "\(version.majorVersion).\(version.minorVersion).\(version.patchVersion)",
            architecture: architecture, memoryBytes: memory > 0 ? memory : nil, freeBytes: free)
        alert.addButton(withTitle: "닫기")
        alert.beginSheetModal(for: window)
    }

    @objc private func showGettingStarted() {
        guard localStorage != nil, !closing, !failed, gettingStartedAlert == nil,
              modelSetupProcess == nil, window.attachedSheet == nil else { return }
        let alert = NSAlert()
        alert.messageText = "이 Mac에서 시작"
        alert.informativeText = LocalGettingStartedStep.introduction
        alert.addButton(withTitle: "선택한 단계 열기")
        alert.addButton(withTitle: "닫기")
        let choice = NSPopUpButton(frame: NSRect(x: 0, y: 0, width: 410, height: 28))
        choice.addItems(withTitles: LocalGettingStartedStep.allCases.map { $0.title })
        choice.target = self
        choice.action = #selector(updateGettingStartedStep)
        let detail = NSTextField(wrappingLabelWithString: LocalGettingStartedStep.preflight.detail)
        detail.frame = NSRect(x: 0, y: 0, width: 410, height: 106)
        let content = NSView(frame: NSRect(x: 0, y: 0, width: 410, height: 146))
        choice.frame.origin.y = 116
        content.addSubview(choice)
        content.addSubview(detail)
        alert.accessoryView = content
        gettingStartedAlert = alert
        gettingStartedChoice = choice
        gettingStartedDetail = detail
        alert.beginSheetModal(for: window) { [weak self] answer in
            guard let self else { return }
            let step = LocalGettingStartedStep.selected(index: choice.indexOfSelectedItem,
                                                        confirmed: answer == .alertFirstButtonReturn)
            self.gettingStartedAlert = nil
            self.gettingStartedChoice = nil
            self.gettingStartedDetail = nil
            guard !self.closing, !self.failed, let step else { return }
            // End this sheet before invoking another existing confirmation sheet.
            DispatchQueue.main.async { [weak self] in self?.openGettingStartedStep(step) }
        }
    }

    @objc private func updateGettingStartedStep() {
        guard let choice = gettingStartedChoice,
              let step = LocalGettingStartedStep(rawValue: choice.indexOfSelectedItem) else { return }
        gettingStartedDetail?.stringValue = step.detail
    }

    private func openGettingStartedStep(_ step: LocalGettingStartedStep) {
        guard localStorage != nil, !closing, !failed, window.attachedSheet == nil else { return }
        switch step {
        case .preflight: showMacPreflight()
        case .account: webView?.load(URLRequest(url: URL(string: "http://127.0.0.1:5601/#/login")!))
        case .verification: openLocalVerification()
        case .orderModel: confirmModelPreparation()
        case .speechModel: confirmWhisperPreparation()
        case .connection: openWorkerSettings()
        case .readiness: showPreparation()
        }
    }

    @objc private func confirmModelPreparation() {
        guard localStorage != nil, modelSetupAlert == nil, modelSetupProcess == nil,
              window.attachedSheet == nil else { return }
        let alert = NSAlert()
        alert.messageText = "주문 정리 모델을 준비할까요?"
        alert.informativeText = "qwen3:4b · Apache-2.0\n공식 Ollama 배포 서버에서 최대 약 2.50GB를 받으며 통신·저장 공간을 사용해요. 녹음이나 원문은 전송하지 않아요.\n\n검증된 앱 전용 Ollama 실행기가 이미 있어야 해요. 설치된 정상 파일은 재사용하며 해시를 확인해요. 받아쓰기 모델은 별도 메뉴로 준비해요. 이 메뉴는 모델 파일만 준비하며 실행기는 Ollama 포함 앱의 첫 실행에서 준비해요."
        alert.addButton(withTitle: "모델 준비 시작")
        alert.addButton(withTitle: "취소")
        alert.beginSheetModal(for: window) { [weak self] answer in
            if answer == .alertFirstButtonReturn { self?.startModelPreparation() }
        }
    }

    @objc private func confirmWhisperPreparation() {
        guard localStorage != nil, modelSetupAlert == nil, modelSetupProcess == nil,
              window.attachedSheet == nil else { return }
        let alert = NSAlert()
        alert.messageText = "받아쓰기 모델을 준비할까요?"
        alert.informativeText = "faster-whisper-small · MIT\n공식 Hugging Face 저장소에서 약 486MB를 받아 파일 해시를 확인해요. 녹음이나 원문은 전송하지 않아요.\n\n모델 파일만 준비해요. Python·전사 실행기 설치와 일꾼 자동 시작은 별도예요."
        alert.addButton(withTitle: "모델 준비 시작")
        alert.addButton(withTitle: "취소")
        alert.beginSheetModal(for: window) { [weak self] answer in
            if answer == .alertFirstButtonReturn {
                self?.startModelPreparation(scriptName: "setup-whisper-model.mjs", title: "받아쓰기 모델 준비")
            }
        }
    }

    private func startModelPreparation(scriptName: String = "setup-local-model.mjs", title: String = "주문 정리 모델 준비") {
        guard let resources = Bundle.main.resourceURL,
              let executable = Bundle.main.url(forAuxiliaryExecutable: "node") else { return }
        let alert = NSAlert()
        modelSetupAlert = alert
        modelSetupFinished = false
        modelSetupBuffer.removeAll()
        alert.messageText = title
        alert.informativeText = "설치된 파일의 무결성과 저장 공간을 확인하고 있어요…"
        alert.addButton(withTitle: "취소")
        alert.beginSheetModal(for: window) { [weak self] _ in
            guard let self else { return }
            self.modelSetupAlert = nil
            if let process = self.modelSetupProcess, process.isRunning { process.terminate() }
        }
        let process = Process()
        let output = Pipe()
        process.executableURL = executable
        process.arguments = [resources.appendingPathComponent(scriptName).path, "--prepare"]
        process.environment = ["HOME": files.homeDirectoryForCurrentUser.path,
                               "PATH": "/usr/bin:/bin:/usr/sbin:/sbin"]
        process.standardOutput = output
        process.standardError = FileHandle.nullDevice
        output.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            if data.isEmpty { handle.readabilityHandler = nil; return }
            DispatchQueue.main.async { self?.receiveModelSetup(data) }
        }
        process.terminationHandler = { [weak self] process in
            DispatchQueue.main.async {
                guard let self else { return }
                self.modelSetupProcess = nil
                if !self.modelSetupFinished {
                    self.modelSetupAlert?.informativeText = process.terminationStatus == 0
                        ? "모델 준비 작업이 끝났어요. 이동 → 로컬 AI 준비 상태에서 연결을 확인해 주세요."
                        : "모델 준비를 마치지 못했어요. 기존 정상 모델은 유지돼요. 실행기·네트워크·저장 공간을 확인해 주세요."
                }
                self.modelSetupAlert?.buttons.first?.title = "확인"
            }
        }
        modelSetupProcess = process
        modelSetupOutput = output
        do { try process.run() }
        catch {
            modelSetupProcess = nil
            output.fileHandleForReading.readabilityHandler = nil
            alert.informativeText = "모델 준비 도구를 시작할 수 없어요. 앱을 다시 빌드하거나 업데이트해 주세요."
            alert.buttons.first?.title = "확인"
        }
    }

    private func receiveModelSetup(_ data: Data) {
        modelSetupBuffer.append(data)
        guard modelSetupBuffer.count < 65536 else {
            modelSetupProcess?.terminate()
            modelSetupBuffer.removeAll()
            return
        }
        while let end = modelSetupBuffer.firstIndex(of: 10) {
            let line = modelSetupBuffer.prefix(upTo: end)
            modelSetupBuffer.removeSubrange(...end)
            guard let value = try? JSONSerialization.jsonObject(with: line) as? [String: Any],
                  let event = value["event"] as? String else { continue }
            switch event {
            case "progress":
                let completed = (value["completed"] as? NSNumber)?.doubleValue ?? 0
                let total = (value["total"] as? NSNumber)?.doubleValue ?? 1
                modelSetupAlert?.informativeText = "모델 파일을 받고 있어요: \(Int(min(100, completed / max(1, total) * 100)))%\n완료 후 파일 해시를 검사해요. 취소하면 정상 모델은 그대로 유지돼요."
            case "preparing":
                modelSetupAlert?.informativeText = "공식 배포 서버에서 필요한 모델 파일을 준비하고 있어요."
            case "ready":
                modelSetupFinished = true
                modelSetupAlert?.informativeText = "모델 파일과 해시 확인이 끝났어요.\n\n이것은 실제 AI 처리 성공을 뜻하지 않아요. 실행기 준비 후 앱을 다시 열어 상태를 확인해 주세요. 음성 일꾼 자동 시작은 별도예요."
            case "error":
                modelSetupFinished = true
                let code = value["code"] as? String ?? ""
                if code == "runtime_missing_or_unverified_use_app_update" {
                    modelSetupAlert?.informativeText = "검증된 앱 전용 실행기가 없어요. 실행기를 포함한 앱 업데이트가 필요해요. 모델 파일은 변경하지 않았어요."
                } else if code == "insufficient_disk_space" {
                    modelSetupAlert?.informativeText = "저장 공간이 부족해요. 여유 공간을 확보한 뒤 다시 시도해 주세요."
                } else if code == "cancelled" {
                    modelSetupAlert?.informativeText = "모델 준비를 취소했어요. 기존 정상 모델은 유지돼요."
                } else {
                    modelSetupAlert?.informativeText = "모델 준비를 마치지 못했어요. 네트워크·파일 무결성·다른 준비 작업을 확인해 주세요. 기존 정상 모델은 유지돼요."
                }
            default: break
            }
        }
    }

    @objc private func openLocalVerification() {
        guard let storage = localStorage, webView != nil, window.attachedSheet == nil else { return }
        let alert = NSAlert()
        alert.messageText = "로컬 가입 인증 링크 열기"
        alert.informativeText = "이 Mac에서 가입한 이메일을 적어 주세요.\n외부 메일함이 아니라 이 Mac에 저장된 가입 링크를 열어요. 암호 확인은 기존 가입 화면에서 진행해요."
        let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 340, height: 24))
        field.placeholderString = "가입한 이메일"
        alert.accessoryView = field
        alert.window.initialFirstResponder = field
        alert.addButton(withTitle: "링크 열기")
        alert.addButton(withTitle: "취소")
        alert.beginSheetModal(for: window) { [weak self] answer in
            guard let self, answer == .alertFirstButtonReturn else { return }
            let outbox = storage.appendingPathComponent("data/outbox", isDirectory: true)
            var link: URL?
            if outbox.resolvingSymlinksInPath().standardizedFileURL == outbox.standardizedFileURL,
               let entries = try? self.files.contentsOfDirectory(at: outbox, includingPropertiesForKeys: [.contentModificationDateKey]) {
                let recent = entries.filter { $0.pathExtension == "json" }.sorted {
                    let a = try? $0.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
                    let b = try? $1.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
                    return (a ?? .distantPast) > (b ?? .distantPast)
                }
                for file in recent.prefix(300) {
                    guard let attrs = try? self.files.attributesOfItem(atPath: file.path),
                          attrs[.type] as? FileAttributeType == .typeRegular,
                          (attrs[.ownerAccountID] as? NSNumber)?.uint32Value == getuid(),
                          let mode = (attrs[.posixPermissions] as? NSNumber)?.intValue, mode & 0o077 == 0,
                          let size = (attrs[.size] as? NSNumber)?.intValue, size <= 16384,
                          let data = try? Data(contentsOf: file) else { continue }
                    if let candidate = LocalVerificationLink.parse(data, email: field.stringValue), self.allows(candidate) {
                        link = candidate
                        break
                    }
                }
            }
            if let link { self.webView?.load(URLRequest(url: link)); return }
            let missing = NSAlert()
            missing.messageText = "유효한 가입 링크가 없어요"
            missing.informativeText = "가입 이메일을 확인하고, 가입 화면의 인증 메일 다시 받기를 누른 뒤 다시 시도해 주세요."
            missing.beginSheetModal(for: self.window)
        }
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
        stopManagedRuntime()
        stopChild()
        window.contentView = NSView(frame: window.contentLayoutRect)
        status.frame = window.contentView!.bounds.insetBy(dx: 28, dy: 28)
        status.stringValue = message
        window.contentView?.addSubview(status)
        webView = nil
    }

    private func stopChild() {
        stopWhisperWorker()
        childOutput?.fileHandleForReading.readabilityHandler = nil
        try? childInput?.fileHandleForWriting.close()
        if let child, child.isRunning { child.terminate() }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        closing = true
        probeSession?.invalidateAndCancel()
        stopManagedRuntime()
        if let modelSetupProcess, modelSetupProcess.isRunning { modelSetupProcess.terminate() }
        stopChild()
        // Never leave the app quit waiting indefinitely for a stuck Node child.
        if let child {
            let deadline = Date().addingTimeInterval(2)
            while child.isRunning && Date() < deadline { Thread.sleep(forTimeInterval: 0.05) }
            if child.isRunning { Darwin.kill(child.processIdentifier, SIGKILL) }
        }
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
