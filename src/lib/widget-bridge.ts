import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Assessment, Course } from '@/data/types'
import { buildWidgetSnapshot } from './widget-snapshot'

/**
 * Keeps the iOS Home Screen widgets current (ios/App/ConcordiaWidgets).
 *
 * The native half (WidgetBridgePlugin.swift) stores the JSON in the shared App
 * Group and asks WidgetKit to reload. A no-op in a browser.
 */
interface WidgetBridgePlugin {
  setSnapshot(options: { json: string }): Promise<void>
  clear(): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge')

const native = (): boolean => {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/**
 * Write a fresh snapshot whenever the term's data changes, a moment after it
 * settles (a burst of edits is one write, and one widget reload). Skipped
 * while the app is showing its OFFLINE copy: that data is already what the
 * widgets have, and rewriting it would only move its timestamp.
 */
export function useWidgetSnapshot(
  courses: Course[],
  assessments: Assessment[],
  enabled: boolean,
): void {
  useEffect(() => {
    if (!native() || !enabled) return
    const t = window.setTimeout(() => {
      const json = JSON.stringify(buildWidgetSnapshot(courses, assessments, new Date()))
      void WidgetBridge.setSnapshot({ json }).catch(() => {})
    }, 1000)
    return () => window.clearTimeout(t)
  }, [courses, assessments, enabled])
}

/** Sign-out: the widgets must not keep showing the last person's deadlines. */
export async function clearWidgets(): Promise<void> {
  if (!native()) return
  try {
    await WidgetBridge.clear()
  } catch {
    /* the widget will show its empty state on its next reload anyway */
  }
}
