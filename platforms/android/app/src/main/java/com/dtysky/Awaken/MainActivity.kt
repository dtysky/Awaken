package com.dtysky.Awaken

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import java.io.ByteArrayInputStream
import android.view.GestureDetector
import android.view.MotionEvent
import kotlin.math.abs


class MainActivity : AppCompatActivity() {
    var mainWebView: AwakenWebView? = null
    private lateinit var gestureDetector: GestureDetector
    private var jsb: AwakenJSB? = null
    private var selectFilesCallback: ((files: Array<String>) -> Unit)? = null
    private val host: String = "http://localhost:8888"
    private val headers: HashMap<String, String> = hashMapOf(
        "Access-Control-Allow-Headers" to "*",
        "Access-Control-Allow-Origin" to "*",
        "Access-Control-Allow-Methods" to "*",
        "Access-Control-Expose-Headers" to "DAV, Content-Type, Allow, WWW-Authenticate"
    )


    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        hideStatusAndTitleBar()

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true)
        }
        mainWebView = findViewById(R.id.main)
        initWebViewSetting(mainWebView)
        jsb = AwakenJSB(this)

        // 初始化手势检测器
        gestureDetector = GestureDetector(this, GestureListener())

        // 将手势监听器应用到 WebView 上
        mainWebView?.setOnTouchListener { v, event ->
            val isGestureDetected = gestureDetector.onTouchEvent(event)
            if (!isGestureDetected) {
                v.performClick()  // 处理点击事件
                return@setOnTouchListener false
            }
            true
        }

        mainWebView?.addJavascriptInterface(jsb!!,"Awaken")
        mainWebView?.loadUrl(if (BuildConfig.DEBUG) { host } else { "http://awaken.api" })
    }

    private fun initWebViewSetting(webView: WebView?) {
        webView?.run {
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.javaScriptEnabled = true
            settings.javaScriptCanOpenWindowsAutomatically = BuildConfig.DEBUG
            settings.setSupportMultipleWindows(true)

            webViewClient = object: WebViewClient() {
                override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                    request?.run {
                        if (request.method == "OPTIONS") {
                            return WebResourceResponse(
                                "", Charsets.UTF_8.toString(), 200, "OK",
                                headers, ByteArrayInputStream(ByteArray(0))
                            )
                        }

                        if (url.host.equals("awaken.api")) {
                            var method: String = url.path.toString().substring(1)
                            var params: MutableMap<String, String> = mutableMapOf(
                                "method" to request.method
                            )
                            url.queryParameterNames.forEach {
                                params[it] = url.getQueryParameter(it).toString()
                            }

                            return jsb!!.callMethod(method, params, requestHeaders)
                        }
                    }

                    return super.shouldInterceptRequest(view, request)
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onCreateWindow(
                    view: WebView,
                    dialog: Boolean,
                    userGesture: Boolean,
                    resultMsg: Message
                ): Boolean {
                    val result = view.hitTestResult
                    val data = result.extra
                    val context = view.context
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(data))
                    context.startActivity(browserIntent)
                    return false
                }
            }
        }
    }

    fun selectFiles(
        mimeTypes: String,
        callback: (files: Array<String>) -> Unit
    ) {
        selectFilesCallback = callback
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mimeTypes
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }

        startActivityForResult(intent, 4)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, resultData: Intent?) {
        if (requestCode == 4) {
            if (resultCode != RESULT_OK) {
                selectFilesCallback?.invoke(arrayOf())
            } else {
                resultData?.data?.also {uri ->
                    selectFilesCallback?.invoke(arrayOf(uri.toString()))
                }
            }
            selectFilesCallback = null
            return
        }

        super.onActivityResult(requestCode, resultCode, resultData)
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
        jsb?.onAppHide()
        mainWebView?.run {
            onPause()
            pauseTimers()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        hideStatusAndTitleBar()
    }

    // 手势监听器
    inner class GestureListener : GestureDetector.SimpleOnGestureListener() {
        private val SWIPE_THRESHOLD = 100  // 滑动的最小距离
        private val SWIPE_VELOCITY_THRESHOLD = 100  // 滑动的最小速度

        override fun onFling(
            e1: MotionEvent?,
            e2: MotionEvent?,
            velocityX: Float,
            velocityY: Float
        ): Boolean {
            try {
                val diffX = e2?.x?.minus(e1!!.x) ?: 0f
                val diffY = e2?.y?.minus(e1!!.y) ?: 0f

                if (abs(diffX) > abs(diffY)) {
                    // 水平滑动
                    if (abs(diffX) > SWIPE_THRESHOLD && abs(velocityX) > SWIPE_VELOCITY_THRESHOLD) {
                        if (diffX > 0) {
                            // 右滑，上一页
                            onSwipeRight()
                        } else {
                            // 左滑，下一页
                            onSwipeLeft()
                        }
                        return true
                    }
                }
            } catch (exception: Exception) {
                exception.printStackTrace()
            }
            return false
        }
    }

    // 处理左滑事件，下一页
    private fun onSwipeLeft() {
        mainWebView?.evaluateJavascript(
            "javascript:(function() { window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'})); })();",
            null
        )
    }

    // 处理右滑事件，上一页
    private fun onSwipeRight() {
        mainWebView?.evaluateJavascript(
            "javascript:(function() { window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'})); })();",
            null
        )
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        mainWebView?.let {
            if (keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
                // 触发上一页的翻页
                it.evaluateJavascript(
                    "javascript:(function() { window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft'})); })();",
                    null
                )
                return true
            } else if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
                // 触发下一页的翻页
                it.evaluateJavascript(
                    "javascript:(function() { window.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight'})); })();",
                    null
                )
                return true
            }
        }
        return super.onKeyDown(keyCode, event)
    }

    private fun hideStatusAndTitleBar() {
        supportActionBar?.hide()

        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS)
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)

        val decorView = window.decorView
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val windowInsetsController = decorView.getWindowInsetsController()
                ?: return
            windowInsetsController.systemBarsBehavior =
                WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            windowInsetsController.hide(WindowInsets.Type.systemBars())
        } else {
            decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN
        }
    }
}
