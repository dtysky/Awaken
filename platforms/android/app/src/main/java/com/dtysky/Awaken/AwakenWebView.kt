package com.dtysky.Awaken

import android.content.Context
import android.util.AttributeSet
import android.view.ActionMode
import android.webkit.WebView


class AwakenWebView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyle: Int = 0
) : WebView(context, attrs, defStyle) {
//    override fun startActionMode(callback: ActionMode.Callback?): ActionMode? {
//        val actionMode = super.startActionMode(callback)
//        return actionMode
//    }
//
//    override fun startActionMode(callback: ActionMode.Callback?, int: Int): ActionMode? {
//        val actionMode = super.startActionMode(callback, int)
//        return actionMode
//    }
}