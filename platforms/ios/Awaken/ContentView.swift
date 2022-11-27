//
//  ContentView.swift
//  Awaken
//
//  Created by dtysky on 2022/11/24.
//

import SwiftUI
import WebKit

struct ContentView: View {
    @State var bgColor: CGColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
    
    var body: some View {
        ZStack() {
            Color(bgColor)
                .frame(minWidth: 0, maxWidth: .infinity, minHeight: 0, maxHeight: .infinity)
                .background(Color.red)
                .edgesIgnoringSafeArea(.all)
            WebView(
                url: URL(string: "http://192.168.2.204:8888")!,
                onChangeBg: changeBgColor
            )
        }
    }
    
    func changeBgColor(color: CGColor) {
        bgColor = color
    }
}

struct WebView: UIViewRepresentable {
    var url: URL
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
        wkWebView.scrollView.bounces = false;

        let request = URLRequest(url: url)
        wkWebView.load(request)
        
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
