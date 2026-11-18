import Foundation

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
