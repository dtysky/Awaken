package com.dtysky.Awaken

import android.R
import android.app.AlertDialog
import android.content.DialogInterface
import android.net.Uri
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebResourceResponse
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.InputStream
import java.nio.file.Path

val client = okhttp3.OkHttpClient()

class AwakenJSB {
    private val mContext: MainActivity
    private val mAlertDialog: AlertDialog.Builder
    private val mBaseDir: Path
    private var mWebdavRequestCache: HashMap<String, Pair<String, Boolean>> = hashMapOf()

    constructor(context: MainActivity) {
        mContext = context
        mBaseDir = context.getExternalFilesDir(null)!!.toPath()
        createDir("", "Settings")
        createDir("", "Log")
        createDir("", "Books")

        mAlertDialog = AlertDialog.Builder(mContext)
        mAlertDialog.setPositiveButton("OK",
            DialogInterface.OnClickListener { dialog, which -> // Write your code here to execute after dialog
                dialog.cancel()
            }
        )
        mAlertDialog.setNegativeButton("Close",
            DialogInterface.OnClickListener { dialog, which -> // Write your code here to execute after dialog
                dialog.cancel()
            }
        )
    }

    private fun getFile(filePath: String, base: String): File {
        if (base == "None") {
            return File(filePath)
        }

        val path = mBaseDir.resolve(base).resolve(filePath);
        return path.toFile()
    }

    private fun getStream(filePath: String, base: String): InputStream {
        if (filePath.startsWith("content")) {
            return mContext.contentResolver.openInputStream(Uri.parse(filePath))!!
        }

        return  getFile(filePath, base).inputStream()
    }

    fun callMethod(
        method: String,
        params: Map<String, String>,
        origHeaders: Map<String, String>
    ): WebResourceResponse {
        val headers = HashMap<String, String>()
        headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        headers["Pragma"] = "no-cache"
        headers["Expires"] = "0"
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Access-Control-Allow-Methods"] = "*"
        headers["Access-Control-Expose-Headers"] = "X-Error-Message, Content-Type, WWW-Authenticate"

        if (params.containsKey("base")) {
            try {
                checkBase(params.getValue("base"));
            } catch (error: Exception) {
                headers["X-Error-Message"] = error.message.toString()
                return WebResourceResponse(
                    "application/json",
                    "utf-8",
                    200,
                    "Error",
                    headers,
                    ByteArrayInputStream(ByteArray(0))
                )
            }
        }

        var stream: InputStream? = null
        var text: String = ""
        var response: okhttp3.Response? = null

        try {
            when (method) {
                "readTextFile" -> {
                    stream = readTextFile(params.getValue("filePath"), params.getValue("base"))
                }
                "readBinaryFile" -> {
                    stream = readBinaryFile(params.getValue("filePath"), params.getValue("base"))
                }
                "removeFile" -> {
                    removeFile(params.getValue("filePath"), params.getValue("base"))
                }
                "createDir" -> {
                    createDir(params.getValue("dirPath"), params.getValue("base"))
                }
                "removeDir" -> {
                    removeDir(params.getValue("dirPath"), params.getValue("base"))
                }
                "readDir" -> {
                    text = readDir(params.getValue("dirPath"), params.getValue("base"))
                }
                "exists" -> {
                    text = exists(params.getValue("filePath"), params.getValue("base"))
                }
                "webdav" -> {
                    response = webdav(params.getValue("url"), params.getValue("method"), origHeaders)
                }
                else -> {
                    stream = loadAsset(method)
                }
            }

            if (response != null) {
                stream = response.body.byteStream()
            }

            if (stream == null) {
                stream = ByteArrayInputStream(text.toByteArray())
            }
        } catch (error: Exception) {
            stream?.close()

            headers["X-Error-Message"] = error.message.toString()
            return WebResourceResponse(
                "application/json",
                "utf-8",
                200,
                "Error",
                headers,
                ByteArrayInputStream(ByteArray(0))
            )
        }

        if (response != null) {
            if (!response.isSuccessful) {
                headers["X-Error-Message"] = response.message
            }
            return WebResourceResponse(
                "", Charsets.UTF_8.toString(), response.code,
                if (response.message == "") { "OK" } else { response.message },
                headers, stream
            )
        }

        return WebResourceResponse("", Charsets.UTF_8.toString(), 200, "OK", headers, stream)
    }

    @JavascriptInterface
    fun getPlatform(): String {
        return "ANDROID";
    }

    @JavascriptInterface
    fun writeTextFile(path: String, base: String, content: String) {
        val stream = getFile(path, base).outputStream()

        try {
            stream.write(content.toByteArray())
            stream.close()
        } catch (e: Exception) {
            stream.close()
            throw e
        }
    }

    @JavascriptInterface
    fun writeBinaryFile(path: String, base: String, content: String) {
        val stream = getFile(path, base).outputStream()

        try {
            stream.write(Base64.decode(content, Base64.DEFAULT))
            stream.close()
        } catch (e: Exception) {
            stream.close()
            throw e
        }
    }

    @JavascriptInterface
    fun showMessage(message: String, type: String, title: String = "") {
        mAlertDialog.setTitle(title)
        mAlertDialog.setMessage(message)

        when (type) {
            "error" -> {
                mAlertDialog.setIcon(R.drawable.stat_notify_error)
            }
            "warning" -> {
                mAlertDialog.setIcon(R.drawable.stat_sys_warning)
            }
            else -> {
                mAlertDialog.setIcon(R.drawable.ic_dialog_info)
            }
        }

        mAlertDialog.show()
    }

    @JavascriptInterface
    fun selectFiles(
        title: String,
        // ext1|ext2, ...
        mimeTypes: String
    ) {
        var res: Array<String> = arrayOf()
        mContext.selectFiles(mimeTypes) {
            res = it
            mContext.mainWebView?.evaluateJavascript(
                "Awaken_SelectFilesHandler(${JSONArray(res)})",
                ValueCallback {  }
            )
        }
    }

    @JavascriptInterface
    fun setBackground(r: Double, g: Double, b: Double) {
        // unnecessary
    }

    @JavascriptInterface
    fun setWebdavRequestBody(url: String, method: String, body: String, isBase64: Boolean) {
        mWebdavRequestCache[method+url] = Pair(body, isBase64)
    }

    fun onAppHide() {
        mContext.mainWebView?.evaluateJavascript(
            "window.Awaken_AppHideCB && window.Awaken_AppHideCB()",
            ValueCallback {  }
        )
    }

    private fun readTextFile(path: String, base: String): InputStream {
        return getStream(path, base)
    }

    private fun readBinaryFile(path: String, base: String): InputStream {
        return getStream(path, base)
    }

    private fun removeFile(path: String, base: String) {
        if (!getFile(path, base).delete()) {
            throw Exception("removeFile failed: ${base}/${path}")
        }
    }

    private fun createDir(path: String, base: String) {
        val file = getFile(path, base)
        if (file.exists()) {
            return
        }

        if (!file.mkdir()) {
            throw Exception("createDir failed: ${base}/${path}")
        }
    }

    private fun removeDir(path: String, base: String) {
        if (!getFile(path, base).delete()) {
            throw Exception("removeDir failed: ${base}/${path}")
        }
    }

    private fun readDir(path: String, base: String): String {
        val res: JSONArray = JSONArray()
        val root = mBaseDir.resolve(base).resolve(path).toString() + "/"

        getFile(path, base).listFiles().forEach {
            val pair: JSONObject = JSONObject()
            pair.put("path", it.path.replace(root, ""))
            pair.put("isDir", it.isDirectory)
            res.put(pair)
        }

        return res.toString()
    }

    private fun exists(path: String, base: String): String {
        return if (getFile(path, base).exists()) "true" else "false"
    }

    private fun webdav(url: String, method: String, headers: Map<String, String>): okhttp3.Response {
        val request = okhttp3.Request.Builder().url(url)
        val cache = mWebdavRequestCache[method+url]

        if (cache == null) {
            request.method(method, null)
        } else {
            if (cache.second) {
                request.method(method, Base64.decode(cache.first, Base64.DEFAULT).toRequestBody())
            } else {
                request.method(method, cache.first.toRequestBody())
            }

            mWebdavRequestCache.remove(method+url)
        }

        headers.forEach {
            request.addHeader(it.key, it.value)
        }

        return client.newCall(request.build()).execute()
    }

    private fun loadAsset(url: String): InputStream {
        return mContext.assets.open(if (url == "") { "index.html" } else { url })
    }

    private fun checkBase(base: String?) {
        if (base != "Books" && base != "Settings" && base != "Log" && base != "None") {
            throw Exception("Base `${base}` is not Supported !")
        }
    }
}
