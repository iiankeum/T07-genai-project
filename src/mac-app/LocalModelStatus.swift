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
