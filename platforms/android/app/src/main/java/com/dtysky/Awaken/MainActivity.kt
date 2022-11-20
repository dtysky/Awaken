package com.dtysky.Awaken

//import android.view.View
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity


class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        hideStatusAndTitleBar()

        WebView.setWebContentsDebuggingEnabled(true)
        val myWebView: WebView = findViewById(R.id.main)
        myWebView.webViewClient = WebViewClient()
        myWebView.settings.javaScriptEnabled = true
        myWebView.addJavascriptInterface(AwakenJSB(this), "AwakenJSB")
        myWebView.loadUrl("http://192.168.2.208:8888")
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