package com.mylifeos.screentime

import android.accessibilityservice.AccessibilityService
import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/** The service only sees foreground package changes. It never reads screen content. */
class BlockService : AccessibilityService() {
  private var overlay: android.view.View? = null
  private var shownFor: String? = null
  private var foreground: String? = null
  private val handler = Handler(Looper.getMainLooper())
  private val poll = object : Runnable { override fun run() { foreground?.let { check(it) }; handler.postDelayed(this, 30000) } }
  override fun onServiceConnected() { super.onServiceConnected(); handler.post(poll) }
  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val id = event.packageName?.toString() ?: return
    foreground = id
    check(id)
  }
  private fun check(id: String) {
    if (id == packageName || id == "com.android.settings") { hide(); return }
    val rule = ruleFor(id) ?: run { hide(); return }
    if (!rule.optBoolean("enabled", true)) { hide(); return }
    val until = runCatching { SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).parse(rule.optString("blocked_until"))?.time ?: 0L }.getOrDefault(0L)
    val limit = rule.optInt("daily_limit_minutes", 1440)
    val usage = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val ops = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val allowed = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), packageName) == AppOpsManager.MODE_ALLOWED
    val start = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
    val now = System.currentTimeMillis()
    val used = if (allowed) usage.queryAndAggregateUsageStats(start, now)[id]?.totalTimeInForeground ?: 0L else 0L
    val prefs = getSharedPreferences("mylife_screen_time", Context.MODE_PRIVATE)
    val key = "auto_${id}_$start"
    var autoUntil = prefs.getLong(key, 0L)
    if (allowed && used >= limit * 60000L && autoUntil == 0L) {
      autoUntil = now + rule.optInt("block_minutes", 60) * 60000L
      prefs.edit().putLong(key, autoUntil).apply()
    }
    if (until > now || autoUntil > now) show(id) else hide()
  }
  private fun ruleFor(id: String): org.json.JSONObject? {
    val text = getSharedPreferences("mylife_screen_time", Context.MODE_PRIVATE).getString("rules", "[]") ?: "[]"
    val rules = runCatching { JSONArray(text) }.getOrNull() ?: return null
    for (i in 0 until rules.length()) rules.optJSONObject(i)?.let { if (it.optString("app_identifier") == id) return it }
    return null
  }
  private fun show(id: String) {
    if (shownFor == id && overlay != null) return
    hide()
    val content = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setBackgroundColor(Color.rgb(20, 33, 61)); setPadding(48, 48, 48, 48) }
    val title = TextView(this).apply { text = getString(R.string.block_title); textSize = 26f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }
    val body = TextView(this).apply { text = getString(R.string.block_body); textSize = 16f; setTextColor(Color.rgb(233, 217, 166)); gravity = Gravity.CENTER; setPadding(0, 24, 0, 0) }
    content.addView(title); content.addView(body)
    val params = WindowManager.LayoutParams(-1, -1, WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE, PixelFormat.TRANSLUCENT)
    runCatching { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).addView(content, params); overlay = content; shownFor = id }
  }
  private fun hide() {
    overlay?.let { runCatching { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(it) } }
    overlay = null; shownFor = null
  }
  override fun onInterrupt() = hide()
  override fun onDestroy() { handler.removeCallbacks(poll); hide(); super.onDestroy() }
}
