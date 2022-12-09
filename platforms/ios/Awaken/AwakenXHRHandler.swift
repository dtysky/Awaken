//
//  AwakenXHRHandler.swift
//  Awaken
//
//  Created by dtysky on 2022/11/24.
//

import Foundation
import WebKit

public class AwakenXHRHandler: NSObject, WKURLSchemeHandler {
    private var stoppedTaskURLs: [URLRequest] = []
    private var jsb: AwakenJSB
    
    init(jsb: AwakenJSB) {
        self.jsb = jsb
        super.init()
    }

    public func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        let request = urlSchemeTask.request
        guard let requestUrl = request.url else { return }
        var method = requestUrl.path
        method = String(method[method.index(method.startIndex, offsetBy: 1)...])
        var params: [String: String] = [:]
        let components = URLComponents(url: requestUrl, resolvingAgainstBaseURL: true)
        let queryItems = components?.queryItems;
        if (queryItems != nil) {
            params = queryItems!.reduce(into: [String: String]()) { (result, item) in
                result[item.name] = item.value
            }
        }
        let body = request.httpBody
        
        if (method == "webdav") {
            let url = URL(string: params["url"]!)! //change the url
            let session = URLSession.shared
            var req = URLRequest(url: url)
            req.httpMethod = request.httpMethod
            req.httpBody = body
            req.allHTTPHeaderFields = request.allHTTPHeaderFields
            let task = session.dataTask(with: req, completionHandler: {[weak self] data, response, error in
                guard let strongSelf = self else { return }
                if (error != nil) {
                    strongSelf.postFailed(to: urlSchemeTask, error: error!)
                } else if (data != nil) {
                    var res = (response as! HTTPURLResponse)
                    var headers: [String: String] = [
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "*",
                        "Access-Control-Expose-Headers": "X-Error-Message, Content-Type, WWW-Authenticate"
                    ]
                    strongSelf.postResponse(to: urlSchemeTask, response: HTTPURLResponse(
                        url: requestUrl, statusCode: res.statusCode,
                        httpVersion: nil, headerFields: headers
                    )!)
                    strongSelf.postResponse(to: urlSchemeTask, data: data!)
                }
                
                strongSelf.postFinished(to: urlSchemeTask)
            })
            
            task.resume()
            return
        }
        
        DispatchQueue.global(qos: .background).async { [weak self] in
            guard let strongSelf = self else { return }
            let res = strongSelf.jsb.callMethod(method: method, params: params, data: body)
            var headers: [String: String] = [
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, DELETE, PUT, OPTIONS",
                "Access-Control-Expose-Headers": "X-Error-Message, Content-Type"
            ]

            if (res.error != nil) {
                headers["X-Error-Message"] = res.error!
            }

            let response = HTTPURLResponse(url: requestUrl, statusCode: 200, httpVersion: nil, headerFields: headers)
            
            if (res.error != nil) {
                strongSelf.postResponse(to: urlSchemeTask, response: response!)
                strongSelf.postFinished(to: urlSchemeTask)
                return;
            }
            
            if (res.file == nil) {
                let data = Data(res.text.utf8)
                strongSelf.postResponse(to: urlSchemeTask, response: response!)
                strongSelf.postResponse(to: urlSchemeTask, data: data)
                strongSelf.postFinished(to: urlSchemeTask)
                return;
            }
            
            let fileHandle = res.file!
            let chunkSize = 1024 * 1024 // 1Mb
            strongSelf.postResponse(to: urlSchemeTask, response: response!)
            var data = fileHandle.readData(ofLength: chunkSize) // get the first chunk
            while (!data.isEmpty && !strongSelf.hasTaskStopped(urlSchemeTask)) {
                strongSelf.postResponse(to: urlSchemeTask, data: data)
                data = fileHandle.readData(ofLength: chunkSize) // get the next chunk
            }
            fileHandle.closeFile()
            strongSelf.postFinished(to: urlSchemeTask)

            // remove the task from the list of stopped tasks (if it is there)
            // since we're done with it anyway
            strongSelf.stoppedTaskURLs = strongSelf.stoppedTaskURLs.filter{$0 != request}
        }
    }
    
    public func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        if (!self.hasTaskStopped(urlSchemeTask)) {
            self.stoppedTaskURLs.append(urlSchemeTask.request)
        }
    }
    
    private func hasTaskStopped(_ urlSchemeTask: WKURLSchemeTask) -> Bool {
        return self.stoppedTaskURLs.contains{$0 == urlSchemeTask.request}
    }
    
    private func postResponse(to urlSchemeTask: WKURLSchemeTask, response: URLResponse) {
        post(to: urlSchemeTask, action: {urlSchemeTask.didReceive(response)})
    }
    
    private func postResponse(to urlSchemeTask: WKURLSchemeTask, data: Data) {
        post(to: urlSchemeTask, action: {urlSchemeTask.didReceive(data)})
    }
    
    private func postFinished(to urlSchemeTask: WKURLSchemeTask) {
        post(to: urlSchemeTask, action: {urlSchemeTask.didFinish()})
    }
    
    private func postFailed(to urlSchemeTask: WKURLSchemeTask, error: Error) {
        post(to: urlSchemeTask, action: {urlSchemeTask.didFailWithError(error)})
    }
    
    private func post(to urlSchemeTask: WKURLSchemeTask, action: @escaping () -> Void) {
        let group = DispatchGroup()
        group.enter()
        DispatchQueue.main.async { [weak self] in
            if (self?.hasTaskStopped(urlSchemeTask) == false) {
                action()
            }
            group.leave()
        }
        group.wait()
    }
}
