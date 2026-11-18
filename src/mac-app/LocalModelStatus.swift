import Foundation
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
