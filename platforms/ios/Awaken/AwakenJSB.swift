//
//  AwakenJSB.swift
//  Awaken
//
//  Created by dtysky on 2022/11/24.
//

import Foundation
import WebKit
import SwiftUI

extension String: Error {}

public struct APIResult {
    var text: String;
    var file: FileHandle?;
    var error: String?;
}

let jsonEncoder = JSONEncoder()

public class AwakenJSB: NSObject, WKScriptMessageHandler, WKUIDelegate {
    public var initJS: String
    private var mBaseDir: URL
    private var mFileManager: FileManager
    private var mWKController: WKUserContentController
    private var mOnChangeBg: (_ color: CGColor) -> ()
    private var webview: WKWebView?

    init(controller: WKUserContentController, onChangeBg: @escaping (_ color: CGColor) -> ()) {
        let paths = NSSearchPathForDirectoriesInDomains(
            .documentDirectory,
            .userDomainMask,
            true
        );
        mBaseDir = URL(fileURLWithPath: paths.last!, isDirectory: true)
        mWKController = controller
        mOnChangeBg = onChangeBg
        mFileManager = FileManager()

        initJS = """
window.Awaken = {
    getPlatform() {
        return 'IOS';
    },
    showMessage(message, type, title) {
        window.webkit.messageHandlers.showMessage.postMessage({title: title, message: message, type: type || ''});
    },
    selectFiles(title, types) {
        window.Awaken.showMessage("iOS设备不支持导入本地书籍，请使用其他平台操作", "error", "");
        window.Awaken_SelectFilesHandler([]);
    },
    setBackground(r, g, b) {
        window.webkit.messageHandlers.setBackground.postMessage({r: r, g: g, b: b});
    }
}
"""
        super.init()

        do {
            try createDir(path: "", base: "Settings")
            try createDir(path: "", base: "Books")
            try createDir(path: "", base: "Log")
        } catch {
            
        }
        
        mWKController.addUserScript(WKUserScript(source: initJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        mWKController.add(self, name: "showMessage")
        mWKController.add(self, name: "setBackground")
    }
    
    public func setWebview(webview: WKWebView) {
        self.webview = webview
        NotificationCenter.default.addObserver(self, selector: #selector(didEnterBackground), name: UIScene.didEnterBackgroundNotification, object: nil)
    }
    
    @objc func didEnterBackground() {
        webview?.evaluateJavaScript("window.Awaken_AppHideCB && window.Awaken_AppHideCB()")
    }

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if (message.name == "showMessage") {
            let params = message.body as! [String: String]
            showMessage(message: params["message"]!, type: params["type"]!, title: params["title"]!)
        } else if (message.name == "setBackground") {
            let params = message.body as! [String: Double]
            setBackground(r: params["r"]!, g: params["g"]!, b: params["b"]!)
        }
    }
    
    public func webView(
        _ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            UIApplication.shared.open(navigationAction.request.url!, options: [:])
        }
        return nil
    }
    
    public func callMethod(
            method: String,
            params: [String : String],
            data: Data?
        ) -> APIResult {
            var res: APIResult = APIResult(text: "")
            
            if (params["base"] != nil) {
                if (!checkBase(base: params["base"])) {
                    res.error = "Base `\(params["base"]!)` is not Supported !"
                    return res
                }
            }

            do {
                switch method {
                    case "readTextFile":
                        res.file = try readTextFile(path: params["filePath"]!, base: params["base"]!)
                    case "readBinaryFile":
                        res.file = try readBinaryFile(path: params["filePath"]!, base: params["base"]!)
                    case "writeTextFile":
                    try writeBinaryFile(path: params["filePath"]!, base: params["base"]!, content: data!)
                    case "writeBinaryFile":
                        try writeBinaryFile(path: params["filePath"]!, base: params["base"]!, content: data!)
                    case "removeFile":
                        try removeFile(path: params["filePath"]!, base: params["base"]!)
                    case "createDir":
                        try createDir(path: params["dirPath"]!, base: params["base"]!)
                    case "removeDir":
                        try removeDir(path: params["dirPath"]!, base: params["base"]!)
                    case "readDir":
                        res.text = try readDir(path: params["dirPath"]!, base: params["base"]!)
                    case "exists":
                        res.text = try exists(path: params["filePath"]!, base: params["base"]!)
                    default:
                        res.file = try loadAsset(url: method)
                }
            } catch {
                do {
                    try res.file?.close()
                } catch {
                    debugPrint(error)
                }

                res.error = "\(error)"
            }

            return res
        }

    private func showMessage(message: String, type: String, title: String = "") {
        let alert = UIAlertController(title: title, message: message, preferredStyle: UIAlertController.Style.alert)
        alert.addAction(UIAlertAction(title: "确定", style: UIAlertAction.Style.default, handler: nil))
        
        UIApplication
            .shared
            .connectedScenes
            .flatMap { ($0 as? UIWindowScene)?.windows ?? [] }
            .first { $0.isKeyWindow }?
            .rootViewController?
            .present(alert, animated: true, completion: nil)
    }
    
    private func setBackground(r: Double, g: Double, b: Double) {
        mOnChangeBg(CGColor(srgbRed: r, green: g, blue: b, alpha: 1))
    }
    
    private func getReadingFile(path: String, base: String) throws -> FileHandle {
        do {
            let file = try FileHandle(forReadingFrom: getPath(path: path, base: base))
            
            return file
        } catch {
            throw "File open faild(\(base) \(path)): \(error)"
        }
    }
    
    private func getPath(path: String, base: String) -> URL {
        if (base == "None") {
            return URL(fileURLWithPath: path);
        }
        
        if (path == "") {
            return mBaseDir.appendingPathComponent(base)
        }
        
        return mBaseDir.appendingPathComponent(base).appendingPathComponent(path)
    }

    private func readTextFile(path: String, base: String) throws -> FileHandle {
        return try getReadingFile(path: path, base: base)
    }

    private func readBinaryFile(path: String, base: String) throws -> FileHandle {
        return try getReadingFile(path: path, base: base)
    }
    
    private func writeTextFile(path: String, base: String, content: String) throws {
        let file = getPath(path: path, base: base)
        try content.write(to: file, atomically: false, encoding: .utf8)
    }
    
    private func writeBinaryFile(path: String, base: String, content: Data) throws {
        let file = getPath(path: path, base: base)
        try content.write(to: file)
    }

    private func removeFile(path: String, base: String) throws {
        try mFileManager.removeItem(at: getPath(path: path, base: base))
    }

    private func createDir(path: String, base: String) throws {
        let existed = mFileManager.fileExists(atPath: getPath(path: path, base: base).path)
        if (existed) {
            return;
        }
        
        try mFileManager.createDirectory(
            at: getPath(path: path, base: base),
            withIntermediateDirectories: true
        )
    }

    private func removeDir(path: String, base: String) throws {
        try mFileManager.removeItem(at: getPath(path: path, base: base))
    }

    private func readDir(path: String, base: String) throws -> String {
        var res: [String] = []
        let root = getPath(path: path, base: base)
        let directoryContents = try mFileManager.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)

        for url in directoryContents {
            var pair: String = ""
            pair += "{"
            pair += "\"path\": \"\(url.lastPathComponent)\","
            pair += "\"isDir\": \(url.hasDirectoryPath)"
            pair += "}"
            res.append(pair)
        }

        return "[\(res.joined(separator: ","))]"
    }

    private func exists(path: String, base: String) throws -> String {
        return mFileManager.fileExists(atPath: getPath(path: path, base: base).path) ? "true" : "false"
    }
    
    private func loadAsset(url: String) throws -> FileHandle {
        let fp = url == "" ? "index.html" : url
        let nameExt = fp.components(separatedBy: ".")
        let rp = Bundle.main.path(forResource: nameExt[0], ofType: nameExt[1], inDirectory: "assets")
        let file = FileHandle(forReadingAtPath: rp!)
        
        if (file == nil) {
            throw "File load error: \(url)"
        }
        
        return file!
    }

    private func checkBase(base: String?) -> Bool {
        if (base != "Books" && base != "Settings" && base != "Log" && base != "None") {
            return false;
        }
        
        return true;
    }
}
