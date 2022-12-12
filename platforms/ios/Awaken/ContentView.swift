//
//  ContentView.swift
//  Awaken
//
//  Created by dtysky on 2022/11/24.
//

import SwiftUI
import WebKit

let host: String = "http://192.168.2.204:8888"

struct ContentView: View {
    @State var bgColor: CGColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
    
    var body: some View {
        ZStack() {
            Color(bgColor)
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .background(Color.red)
                .edgesIgnoringSafeArea(.all)
            WebView(
                onChangeBg: changeBgColor
            )
        }
    }
    
    func changeBgColor(color: CGColor) {
        bgColor = color
    }
}

struct WebView: UIViewRepresentable {
    var onChangeBg: (_ color: CGColor) -> ()

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences = WKWebpagePreferences()
        config.defaultWebpagePreferences.allowsContentJavaScript = true
        config.preferences = WKPreferences()
        config.preferences.javaScriptEnabled = true
        config.userContentController = WKUserContentController()
        
        let jsb = AwakenJSB(
            controller:  config.userContentController,
            onChangeBg: onChangeBg
        )
        
        config.setURLSchemeHandler(AwakenXHRHandler(jsb: jsb), forURLScheme: "awaken")

        let wkWebView = WKWebView(frame: .zero, configuration: config)
        wkWebView.scrollView.bounces = false
        wkWebView.scrollView.alwaysBounceHorizontal = false
        wkWebView.scrollView.alwaysBounceVertical = false

        #if RELEASE
        let rp = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "assets")!
        do {
            let str = try String(contentsOfFile: rp, encoding: .utf8)
            wkWebView.loadHTMLString(str, baseURL: URL(string: "awaken://awaken.api")!)
        } catch {
            wkWebView.load(URLRequest(url: URL(string: host)!))
        }
        #else
        let request = URLRequest(url: URL(string: host)!)
        wkWebView.load(request)
        #endif
        
        jsb.setWebview(webview: wkWebView)

        return wkWebView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {

    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
