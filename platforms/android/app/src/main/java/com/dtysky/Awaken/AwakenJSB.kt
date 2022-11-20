package com.dtysky.Awaken

import android.content.Context
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.nio.Buffer

class AwakenJSB(private val mContext: Context) {
    @JavascriptInterface
    fun getSettingsPath(): String {
        return "sssssssss";
    }

    @JavascriptInterface
    fun getLogPath(): String {
        return "sssssssss";
    }

    @JavascriptInterface
    fun getBooksPath(): String {
        return "sssssssss";
    }

    // return [fp1, fp2, ...]
    @JavascriptInterface
    fun selectBooks(
        title: String,
        // ext1, ext2, ...
        extensions: String,
    ): String {
        return "[]";
    }

    @JavascriptInterface
    fun showMessage(message: String, type: String, title: String = "") {

    }

    @JavascriptInterface
    fun readTextFile(fp: String): String {
        return "sssssssss";
    }

//    @JavascriptInterface
//    fun readBinaryFile(fp: String): Buffer {
//        return "sssssssss";
//    }

    @JavascriptInterface
    fun writeTextFile(fp: String, content: String) {

    }

//    @JavascriptInterface
//    fun writeBinaryFile(fp: String, content: Buffer) {
//
//    }

    @JavascriptInterface
    fun remoteFile(fp: String) {

    }

    @JavascriptInterface
    fun createDir(fp: String) {

    }

    @JavascriptInterface
    fun removeDir(fp: String) {

    }

    // return json [{"path": String, "isDir": Boolean}...]
    @JavascriptInterface
    fun readDir(fp: String): String {
        return "[]";
    }

    @JavascriptInterface
    fun exists(fp: String): Boolean {
        return false;
    }

//    fun showToast(toast: String) {
//        Toast.makeText(mContext, toast, Toast.LENGTH_SHORT).show()
//    }
}
