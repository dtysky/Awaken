package com.dtysky.Awaken

import android.content.Context
import android.util.AttributeSet
import android.webkit.WebView


class AwakenWebView: WebView {
    constructor(context: Context) : super(context) {}
    constructor(context: Context, attrs: AttributeSet) : super(context, attrs) {}
    constructor(context: Context, attrs: AttributeSet, defStyle: Int) : super(context, attrs, defStyle) {}
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