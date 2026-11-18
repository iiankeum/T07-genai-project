import Foundation

func check(_ condition: Bool, _ label: String) {
    precondition(condition, label)
    print("PASS: \(label)")
}
func message(_ json: String, _ status: Int = 200, _ model: String = "qwen3:4b") -> String {
    LocalModelStatus.message(data: Data(json.utf8), statusCode: status, model: model)
}
check(LocalModelStatus.message(data: nil, statusCode: nil, model: "qwen3:4b").contains("연결 안 됨"), "missing runtime")
check(message("{}", 302).contains("연결 안 됨"), "redirect not readiness")
check(message("oops").contains("연결 안 됨"), "invalid response")
check(message("{\"models\":[]}").contains("모델 준비 필요"), "empty models")
check(message("{\"models\":[{\"name\":\"other:latest\"}]}").contains("모델 준비 필요"), "wrong model")
check(message("{\"models\":[{\"name\":\"qwen3:4b\"}]}").contains("설치 확인"), "installed model")
check(message("{\"models\":[{\"name\":\"qwen3:latest\"}]}", 200, "qwen3").contains("설치 확인"), "default latest tag")
check(message("{\"models\":[{\"name\":\"qwen3:4b\"}]}").contains("아직 확인하지"), "not claiming inference")
