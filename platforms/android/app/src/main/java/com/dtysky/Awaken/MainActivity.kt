package com.dtysky.Awaken

import android.os.Build
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.*
import androidx.appcompat.app.AppCompatActivity


class MainActivity : AppCompatActivity() {
    private var mainWebView: WebView? = null
    private var jsb: AwakenJSB? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        hideStatusAndTitleBar()

        WebView.setWebContentsDebuggingEnabled(true)
        val mainWebView: WebView = findViewById(R.id.main)
        initWebViewSetting(mainWebView)
        var base = getExternalFilesDir(null)
        jsb = AwakenJSB(this)
        mainWebView.addJavascriptInterface(jsb!!,"Awaken")
        mainWebView.loadUrl("http://192.168.2.208:8888")
    }

    private fun initWebViewSetting(webView: WebView?) {
        webView?.run {
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.domStorageEnabled = true
//            settings.allowContentAccess = true
//            settings.allowFileAccess = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.javaScriptEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = true
            settings.setSupportMultipleWindows(true)

            webViewClient = object: WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    request?.run {
                        if (url.host.equals("awaken.api")) {
                            var method: String = url.path.toString().substring(1)
                            var params: MutableMap<String, String> = mutableMapOf()
                            url.queryParameterNames.forEach {
                                params.put(it, url.getQueryParameter(it).toString())
                            }

                            return jsb!!.callMethod(method, params)
                        }
                    }
                    return super.shouldInterceptRequest(view, request)
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        mainWebView?.run {
            onResume()
            resumeTimers()
        }
    }

    override fun onPause() {
        super.onPause()
        mainWebView?.run {
            onPause()
            pauseTimers()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        hideStatusAndTitleBar()
    }

    private fun hideStatusAndTitleBar() {
        supportActionBar?.hide()
//        val decorView = window.decorView
//        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
//            val windowInsetsController: WindowInsetsController = decorView.getWindowInsetsController()
//                ?: return
//            windowInsetsController.systemBarsBehavior =
//                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
//            windowInsetsController.hide(WindowInsets.Type.systemBars())
//        } else {
//            decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN
//        }
    }
}