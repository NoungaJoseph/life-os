package com.mylifeos.screentime

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class ScreenTimeModule : Module() {
  private val context: Context get() = appContext.reactContext ?: error("React context unavailable")
  override fun definition() = ModuleDefinition {
    Name("MyLifeScreenTime")
    Function("hasUsagePermission") { hasUsagePermission() }
    Function("hasAccessibilityPermission") { hasAccessibilityPermission() }
    Function("openUsageSettings") {
      context.startActivity(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    Function("openAccessibilitySettings") {
      context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    AsyncFunction("installedApps") {
      val launch = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      context.packageManager.queryIntentActivities(launch, 0).mapNotNull { info ->
        val id = info.activityInfo?.packageName ?: return@mapNotNull null
        mapOf("identifier" to id, "name" to info.loadLabel(context.packageManager).toString())
      }.distinctBy { it["identifier"] }.sortedBy { it["name"] }
    }
    AsyncFunction("dailyUsage") {
      if (!hasUsagePermission()) emptyList<Map<String, Any>>() else {
        val manager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -6); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0) }
        val date = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val rows = mutableListOf<Map<String, Any>>()
        while (calendar.timeInMillis < now) {
          val start = calendar.timeInMillis
          calendar.add(Calendar.DAY_OF_YEAR, 1)
          val end = minOf(calendar.timeInMillis, now)
          for ((id, stat) in manager.queryAndAggregateUsageStats(start, end)) {
            if (stat.totalTimeInForeground > 0) rows.add(mapOf("app_identifier" to id, "used_on" to date.format(start), "minutes" to ((stat.totalTimeInForeground + 59999) / 60000).toInt()))
          }
        }
        rows
      }
    }
    Function("applyRules") { rules: List<Map<String, Any?>> ->
      val array = JSONArray()
      for (rule in rules) array.put(org.json.JSONObject(rule))
      context.getSharedPreferences("mylife_screen_time", Context.MODE_PRIVATE).edit().putString("rules", array.toString()).apply()
    }
  }
  private fun hasUsagePermission(): Boolean {
    val manager = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    return manager.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
  }
  private fun hasAccessibilityPermission(): Boolean {
    val manager = context.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
    return manager.getEnabledAccessibilityServiceList(-1).any { it.resolveInfo.serviceInfo.packageName == context.packageName && it.resolveInfo.serviceInfo.name == BlockService::class.java.name }
  }
}
