import Foundation
import Darwin
import CoreFoundation

// 파일 존재가 아니라 실행 중인 로컬 서버의 목록만 확인한다. 실제 추론 성공과 구분한다.
enum LocalModelStatus {
    static func message(data: Data?, statusCode: Int?, model: String) -> String {
        guard statusCode == 200, let data, data.count <= 1_048_576,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let models = object["models"] as? [[String: Any]] else {
            return "주문 정리 AI: 연결 안 됨\nOllama를 준비하고 실행한 뒤 다시 확인해 주세요. 수동 업무는 계속할 수 있어요."
        }
        let names = models.compactMap { $0["name"] as? String }
        let found = names.contains(model) || (!model.contains(":") && names.contains(model + ":latest"))
        if found {
            return "주문 정리 AI: \(model) 설치 확인\n실제 답변 생성은 아직 확인하지 않았어요. 통화 원문에서 AI 기능을 실행해 검증해 주세요."
        }
        return "주문 정리 AI: 모델 준비 필요\nOllama는 실행 중이지만 \(model) 모델이 없어요. 모델 준비 안내를 확인해 주세요."
    }
}

// 로컬 준비 점검이 외부 주소로 리다이렉트되지 않게 한다.
final class LocalProbeDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
}

// 로컬 개발용 outbox만 연다. 서버 인증/암호 검사는 웹 앱에서 그대로 수행한다.
enum LocalVerificationLink {
    static func parse(_ data: Data, email: String, now: Date = Date()) -> URL? {
        guard data.count <= 16384,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["kind"] as? String == "verify",
              (object["to"] as? String)?.lowercased() == email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              let expiry = object["expiresAt"] as? String,
              let raw = object["url"] as? String,
              let parts = URLComponents(string: raw),
              parts.scheme == "http", parts.host == "127.0.0.1", parts.port == 5601,
              parts.user == nil, parts.password == nil, parts.query == nil,
              parts.path == "/", let fragment = parts.fragment,
              fragment.range(of: #"\A/verify\?token=[A-Za-z0-9_-]{43}\z"#, options: .regularExpression) != nil else { return nil }
        let dates = ISO8601DateFormatter()
        dates.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let expires = dates.date(from: expiry), expires > now else { return nil }
        return parts.url
    }
}


// 개발 선택은 번들 안의 고정된 두 표지가 일치할 때만 허용한다.
enum LocalDevelopmentProfile {
    static func storageName(info: Any?, data: Data?) throws -> String {
        if info == nil && data == nil { return "Ahmatda" }
        guard let tag = info as? String, tag == "development-whisper-pyav-lgpl-v1",
              let data, data.count < 1024,
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              Set(object.keys) == Set(["version", "profile"]),
              let version = object["version"] as? NSNumber,
              CFGetTypeID(version) != CFBooleanGetTypeID(), version.intValue == 1, version.doubleValue == 1,
              object["profile"] as? String == tag else {
            throw NSError(domain: "AhmatdaDevelopmentProfile", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "개발 프로파일 표지가 맞지 않아요. 기본 앱으로 돌아가거나 개발 앱을 다시 빌드해 주세요."])
        }
        return "Ahmatda-PyAV-Dev"
    }
}

// Navigation guidance, never persisted as completion or inferred from opening a screen.
enum LocalGettingStartedStep: Int, CaseIterable {
    case preflight, account, verification, orderModel, speechModel, connection, readiness
    var title: String {
        switch self {
        case .preflight: return "1. 이 Mac 점검"
        case .account: return "2. 계정과 작업공간 만들기"
        case .verification: return "3. 가입 인증 링크 열기"
        case .orderModel: return "4. 주문 정리 모델 준비"
        case .speechModel: return "5. 받아쓰기 모델 준비"
        case .connection: return "6. 이 작업공간에 받아쓰기 연결"
        case .readiness: return "7. 준비 상태 확인"
        }
    }
    var detail: String {
        switch self {
        case .preflight: return "macOS·아키텍처·메모리·저장 공간을 읽기만 해요. 지원 여부나 모델 실행 성공을 판정하지 않으며 설정과 파일을 변경하지 않아요."
        case .account: return "로그인 화면에서 가입하거나 기존 계정으로 로그인해요. 비밀번호와 약관 동의는 직접 입력하고 작업공간을 선택해 주세요."
        case .verification: return "이 Mac에서 가입한 이메일을 직접 입력해 인증 링크를 열어요. 링크를 여는 것만으로 인증이나 로그인이 완료되지는 않아요."
        case .orderModel: return "주문 정리용 qwen3:4b 모델은 약 2.50GB예요. 다음 확인창에서 동의해야 내려받아요. 파일 준비와 실제 답변 생성 성공은 달라요."
        case .speechModel: return "받아쓰기용 small 모델은 약 486MB예요. 다음 확인창에서 동의해야 내려받아요. 검증된 전사 실행기가 포함된 앱도 필요해요."
        case .connection: return "설정에서 관리자가 현재 작업공간을 확인하고 직접 연결해요. 승인은 30일간 유효하며 다른 공간의 기존 연결은 교체돼요. 이 안내에서는 권한을 부여하지 않아요."
        case .readiness: return "설치·실행 상태만 확인해요. 실제 전사와 주문 정리 결과는 권한 있는 시험 녹음을 직접 넣어 확인해야 해요. 모델 설치나 일꾼 실행만으로 결과 품질을 보장하지 않아요."
        }
    }
    static func selected(index: Int, confirmed: Bool) -> Self? {
        confirmed ? Self(rawValue: index) : nil
    }
    static let introduction = "필요한 단계를 골라 직접 진행하세요. 이미 끝낸 단계는 건너뛰어도 돼요. 이 안내는 완료 여부를 판정하지 않으며, 닫아도 가입·다운로드·연결은 시작되지 않아요."
}


// Read-only inventory presentation. No hardware value is treated as an install approval.
enum LocalMacPreflight {
    static func capacity(_ bytes: UInt64?, binary: Bool = false) -> String {
        guard let bytes else { return "확인 불가" }
        let divisor = binary ? 1_073_741_824.0 : 1_000_000_000.0
        return String(format: "%.1f %@", locale: Locale(identifier: "en_US_POSIX"), Double(bytes) / divisor, binary ? "GiB" : "GB")
    }
    static func report(os: String?, architecture: String?, memoryBytes: UInt64?, freeBytes: UInt64?) -> String {
        let version = os?.trimmingCharacters(in: .whitespacesAndNewlines)
        let architecture = architecture?.trimmingCharacters(in: .whitespacesAndNewlines)
        return """
        macOS: \(version?.isEmpty == false ? version! : "확인 불가")
        실행 아키텍처: \(architecture?.isEmpty == false ? architecture! : "확인 불가")
        물리 메모리: \(capacity(memoryBytes, binary: true))
        앱 자료 저장 볼륨의 남은 공간: \(capacity(freeBytes))

        현재 시점의 참고 정보이며, 메모리·공간이 충분하거나 이 Mac이 지원된다는 판정은 아니에요. 저장 공간 조회 실패는 ‘확인 불가’로 표시해요.

        두 모델 다운로드는 합계 약 3GB가 참고량이에요. 전사 캐시·실행기·압축 해제·설치 중 임시 파일의 여유 공간은 별도로 필요하고, 실제 사용량은 달라져요. 다운로드 직전 확인창의 용량을 다시 확인하세요.

        일부 포함 Ollama 라이브러리는 macOS 26.2 이상을 요구해요. macOS 14 지원이나 새 Mac 호환성을 보장하지 않아요. OS 버전만으로 전체 실행기 호환성을 확정할 수 없어요.

        파일 존재·설치 확인과 실제 전사·답변 생성 성공은 달라요. 이 점검은 읽기 전용이며 다운로드·설정 변경 없이 수동 업무를 계속할 수 있어요.
        """
    }
}

// Bounded metadata-only inspection. Directory descriptors prevent following replaced symlinks.
enum LocalModelStorageUsage {
    struct Row { let title: String; let bytes: UInt64?; let sharedFiles: Int }
    static let locations = [
        ("주문 모델 파일 위치", "models/ollama/blobs"),
        ("받아쓰기 모델 파일 위치", "whisper-small"),
        ("주문 모델 부분 다운로드", "models/ollama/.partial-blobs"),
        ("받아쓰기 저장 캐시", ".whisper-verified-cache"),
        ("받아쓰기 부분 다운로드", ".whisper-partial-cache")
    ]
    static func inspect(root: URL, limit: Int = 8000) -> [Row] {
        var seen = Set<String>(), remaining = limit
        let base = open(root.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard base >= 0 else { return locations.map { Row(title: $0.0, bytes: nil, sharedFiles: 0) } }
        defer { close(base) }
        func walk(_ fd: Int32, _ bytes: inout UInt64, _ shared: inout Int, depth: Int = 0) throws {
            guard depth < 64 else { throw CocoaError(.fileReadTooLarge) }
            let copied = dup(fd)
            guard copied >= 0 else { throw CocoaError(.fileReadUnknown) }
            guard let directory = fdopendir(copied) else { close(copied); throw CocoaError(.fileReadUnknown) }
            defer { closedir(directory) }
            while true {
                errno = 0
                guard let entry = readdir(directory) else {
                    if errno != 0 { throw CocoaError(.fileReadUnknown) }; break
                }
                let name = withUnsafeBytes(of: &entry.pointee.d_name) { String(bytes: $0.prefix { $0 != 0 }, encoding: .utf8) }
                guard let name else { throw CocoaError(.fileReadUnknown) }
                if name == "." || name == ".." { continue }
                remaining -= 1
                guard remaining >= 0 else { throw CocoaError(.fileReadTooLarge) }
                var info = stat()
                guard fstatat(fd, name, &info, AT_SYMLINK_NOFOLLOW) == 0 else { throw CocoaError(.fileReadUnknown) }
                if (info.st_mode & S_IFMT) == S_IFLNK { throw CocoaError(.fileReadUnsupportedScheme) }
                if (info.st_mode & S_IFMT) == S_IFDIR {
                    let child = openat(fd, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                    guard child >= 0 else { throw CocoaError(.fileReadUnknown) }
                    defer { close(child) }
                    try walk(child, &bytes, &shared, depth: depth + 1)
                } else if (info.st_mode & S_IFMT) == S_IFREG {
                    guard info.st_size >= 0 else { throw CocoaError(.fileReadUnknown) }
                    let key = "\(info.st_dev):\(info.st_ino)"
                    if seen.insert(key).inserted {
                        guard let sum = adding(bytes, UInt64(info.st_size)) else { throw CocoaError(.fileReadTooLarge) }
                        bytes = sum
                    } else { shared += 1 }
                } else { throw CocoaError(.fileReadUnknown) }
            }
        }
        return locations.map { title, relative in
            var fd = dup(base), missing = false
            for part in relative.split(separator: "/") {
                let next = openat(fd, String(part), O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
                let error = errno
                close(fd); fd = next
                if next < 0 { missing = error == ENOENT; break }
            }
            guard fd >= 0 else { return Row(title: title, bytes: missing ? 0 : nil, sharedFiles: 0) }
            defer { close(fd) }
            let oldSeen = seen
            var bytes: UInt64 = 0, shared = 0
            do { try walk(fd, &bytes, &shared); return Row(title: title, bytes: bytes, sharedFiles: shared) }
            catch { seen = oldSeen; return Row(title: title, bytes: nil, sharedFiles: 0) }
        }
    }
    static func adding(_ left: UInt64, _ right: UInt64) -> UInt64? {
        let (sum, overflow) = left.addingReportingOverflow(right)
        return overflow ? nil : sum
    }
    static func report(_ rows: [Row]) -> String {
        rows.map { "\($0.title): \(LocalMacPreflight.capacity($0.bytes))" + ($0.bytes.map { " [\($0)바이트]" } ?? "") + ($0.sharedFiles > 0 ? " (공유 파일 \($0.sharedFiles)개 중복 제외)" : "") }.joined(separator: "\n") + "\n\n파일 크기 합계이며 실제 디스크 점유량이나 삭제 시 확보되는 공간은 아니에요. 같은 inode의 하드링크는 위 항목부터 한 번만 계산해요.\n\n위치로 구분했을 뿐 설치 완료·무결성·재개 가능 여부는 검증하지 않았어요. 캐시는 다음 모델 준비 때 다시 검증해요. 조회 실패·심볼릭 링크·항목·깊이·크기 제한 초과는 ‘확인 불가’예요. 준비 작업 중에는 값이 달라질 수 있어요.\n\n실행기·설치 중 임시 폴더·기타 자료는 제외돼요. 읽기 전용으로, 삭제·정리·다운로드는 하지 않아요."
    }
}

// One explicit server origin only; no credentials, navigation path or persisted choice.
enum TeamServerAddress {
    static func validated(_ input: String, confirmed: Bool) -> URL? {
        guard confirmed, input.utf8.count <= 2048 else { return nil }
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty, !raw.contains("\\"),
              raw.rangeOfCharacter(from: .whitespacesAndNewlines.union(.controlCharacters)) == nil,
              var parts = URLComponents(string: raw), parts.scheme?.lowercased() == "https",
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/", let host = parts.host, !host.isEmpty,
              !host.contains("%"), parts.port == nil || (1...65535).contains(parts.port!) else { return nil }
        if host.contains(":") {
            let value = host.hasPrefix("[") && host.hasSuffix("]") ? String(host.dropFirst().dropLast()) : host
            var address = in6_addr()
            guard inet_pton(AF_INET6, value, &address) == 1 else { return nil }
        } else {
            guard host.utf8.count <= 253, host.unicodeScalars.allSatisfy({ $0.isASCII }),
                  host.split(separator: ".", omittingEmptySubsequences: false).allSatisfy({ label in
                      !label.isEmpty && label.utf8.count <= 63 && label.first != "-" && label.last != "-" &&
                      label.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber || $0 == "-") })
                  }) else { return nil }
        }
        parts.scheme = "https"
        parts.path = "/"
        return parts.url
    }
}


// 설정은 private 정규 파일 fd에서만 제한된 크기로 읽는다. 설정 쓰기·모델 조회는 하지 않는다.
enum LocalAIConfiguration {
    static let maximumBytes = 4096
    private struct Configuration: Decodable { let provider: String; let model: String? }
    static func allowedMetadata(_ info: stat, owner: uid_t) -> Bool {
        (info.st_mode & S_IFMT) == S_IFREG && info.st_uid == owner &&
        (info.st_mode & 0o022) == 0 && info.st_nlink == 1 &&
        info.st_size >= 0 && info.st_size <= maximumBytes
    }
    static func environment(in storage: URL) throws -> [String: String] {
        let fallback = ["AI_PROVIDER": "ollama", "OLLAMA_MODEL": "qwen3:4b"]
        let directory = open(storage.path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC)
        guard directory >= 0 else { throw CocoaError(.fileReadNoPermission) }
        defer { close(directory) }
        var root = stat()
        guard fstat(directory, &root) == 0, root.st_uid == geteuid(),
              (root.st_mode & 0o077) == 0 else { throw CocoaError(.fileReadNoPermission) }
        let fd = openat(directory, "ai.json", O_RDONLY | O_NOFOLLOW | O_NONBLOCK | O_CLOEXEC)
        if fd < 0 {
            if errno == ENOENT { return fallback }
            throw CocoaError(.fileReadNoPermission)
        }
        defer { close(fd) }
        var before = stat()
        guard fstat(fd, &before) == 0, allowedMetadata(before, owner: geteuid()) else {
            throw CocoaError(.fileReadNoPermission)
        }
        var data = Data(), buffer = [UInt8](repeating: 0, count: maximumBytes + 1)
        while data.count <= maximumBytes {
            let count = read(fd, &buffer, maximumBytes + 1 - data.count)
            if count < 0 { if errno == EINTR { continue }; throw CocoaError(.fileReadUnknown) }
            if count == 0 { break }
            data.append(contentsOf: buffer.prefix(count))
        }
        var after = stat()
        guard data.count <= maximumBytes, fstat(fd, &after) == 0,
              allowedMetadata(after, owner: geteuid()), before.st_size == after.st_size,
              before.st_mtimespec.tv_sec == after.st_mtimespec.tv_sec,
              before.st_mtimespec.tv_nsec == after.st_mtimespec.tv_nsec,
              data.count == after.st_size else { throw CocoaError(.fileReadCorruptFile) }
        let config = try JSONDecoder().decode(Configuration.self, from: data)
        if config.provider == "off" { return ["AI_PROVIDER": "off"] }
        let name = config.model ?? "qwen3:4b"
        guard config.provider == "ollama", name.count <= 128,
              name.range(of: #"\A(?:[a-z0-9][a-z0-9_-]*/)?[a-z0-9][a-z0-9_.-]*(?::[a-z0-9][a-z0-9_.-]*)?\z"#,
                         options: [.regularExpression, .caseInsensitive]) != nil,
              name.range(of: #"(?:^|[/:._-])cloud(?:$|[/:._-])"#,
                         options: [.regularExpression, .caseInsensitive]) == nil else {
            throw CocoaError(.fileReadCorruptFile)
        }
        return ["AI_PROVIDER": "ollama", "OLLAMA_MODEL": name]
    }
}
