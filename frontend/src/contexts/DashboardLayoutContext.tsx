/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../api'

export type DashboardStaticCardId =
  | 'status'
  | 'quick'
  | 'connection'
  | 'sim'
  | 'resources'
  | 'speed'
  | 'temperature'

export type DashboardCustomCardId = `custom-${string}`
export type DashboardCardId = DashboardStaticCardId | DashboardCustomCardId
export type DashboardCustomWidgetType = 'text' | 'image'

export interface DashboardLayoutItem {
  id: DashboardCardId
  x: number
  y: number
  w: number
  h: number
  minW: number
  minH: number
}

export interface DashboardCustomWidget {
  id: DashboardCustomCardId
  type: DashboardCustomWidgetType
  title: string
  content: string
}

interface DashboardLayoutSnapshot {
  layout: DashboardLayoutItem[]
  widgets: DashboardCustomWidget[]
}

interface DashboardLayoutContextType {
  editMode: boolean
  setEditMode: (enabled: boolean) => void
  isDirty: boolean
  layout: DashboardLayoutItem[]
  setLayout: (layout: DashboardLayoutItem[]) => void
  widgets: DashboardCustomWidget[]
  addCustomWidget: (type: DashboardCustomWidgetType) => void
  updateCustomWidget: (id: DashboardCustomCardId, patch: Partial<Omit<DashboardCustomWidget, 'id'>>) => void
  removeCustomWidget: (id: DashboardCustomCardId) => void
  editingWidgetId: DashboardCustomCardId | null
  setEditingWidgetId: (id: DashboardCustomCardId | null) => void
  saveLayout: () => void
  resetLayout: () => void
}

const DASHBOARD_LAYOUT_STORAGE_KEY = 'udx710-dashboard-layout-v2'
const LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY = 'udx710-dashboard-layout-v1'
export const DASHBOARD_GRID_COLUMNS = 12
export const DASHBOARD_GRID_MAX_ROWS = 20
const TEXT_WIDGET_CONTENT_LIMIT = 120000
const IMAGE_WIDGET_CONTENT_LIMIT = 8000000
const SYSTEM_RESOURCES_DEFAULT_SIZE = { w: 3, h: 6 }
const CUSTOM_WIDGET_DEFAULT_SIZE = { w: 2, h: 2 }
const CUSTOM_WIDGET_MIN_SIZE = { w: 1, h: 1 }

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayoutItem[] = [
  { id: 'status', x: 0, y: 0, w: 12, h: 1, minW: 6, minH: 1 },
  { id: 'quick', x: 0, y: 1, w: 3, h: 3, minW: 3, minH: 3 },
  { id: 'connection', x: 3, y: 1, w: 3, h: 3, minW: 3, minH: 3 },
  { id: 'sim', x: 6, y: 1, w: 3, h: 3, minW: 3, minH: 3 },
  {
    id: 'resources',
    x: 9,
    y: 1,
    w: SYSTEM_RESOURCES_DEFAULT_SIZE.w,
    h: SYSTEM_RESOURCES_DEFAULT_SIZE.h,
    minW: SYSTEM_RESOURCES_DEFAULT_SIZE.w,
    minH: SYSTEM_RESOURCES_DEFAULT_SIZE.h,
  },
  { id: 'speed', x: 0, y: 4, w: 8, h: 5, minW: 5, minH: 5 },
  { id: 'temperature', x: 8, y: 7, w: 4, h: 3, minW: 3, minH: 3 },
]

const DashboardLayoutContext = createContext<DashboardLayoutContextType | undefined>(undefined)

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const cloneLayout = (layout: DashboardLayoutItem[]) => layout.map((item) => ({ ...item }))

const cloneWidgets = (widgets: DashboardCustomWidget[]) => widgets.map((widget) => ({ ...widget }))

export const isCustomCardId = (id: DashboardCardId): id is DashboardCustomCardId => id.startsWith('custom-')

const createCustomId = (): DashboardCustomCardId => {
  const randomId = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

  return `custom-${randomId}`
}

const sanitizeText = (value: unknown, fallback = '', limit = TEXT_WIDGET_CONTENT_LIMIT) => {
  return typeof value === 'string' ? value.slice(0, limit) : fallback
}

const sanitizeWidgetContent = (type: DashboardCustomWidgetType, value: unknown, fallback = '') => {
  return sanitizeText(
    value,
    fallback,
    type === 'image' ? IMAGE_WIDGET_CONTENT_LIMIT : TEXT_WIDGET_CONTENT_LIMIT
  )
}

const createCustomLayoutItem = (
  id: DashboardCustomCardId,
  layout: DashboardLayoutItem[]
): DashboardLayoutItem => {
  const width = CUSTOM_WIDGET_DEFAULT_SIZE.w
  const height = CUSTOM_WIDGET_DEFAULT_SIZE.h

  for (let y = 0; y <= DASHBOARD_GRID_MAX_ROWS - height; y += 1) {
    for (let x = 0; x <= DASHBOARD_GRID_COLUMNS - width; x += 1) {
      const candidate: DashboardLayoutItem = {
        id,
        x,
        y,
        w: width,
        h: height,
        minW: CUSTOM_WIDGET_MIN_SIZE.w,
        minH: CUSTOM_WIDGET_MIN_SIZE.h,
      }
      const hasCollision = layout.some((item) => (
        candidate.x < item.x + item.w &&
        candidate.x + candidate.w > item.x &&
        candidate.y < item.y + item.h &&
        candidate.y + candidate.h > item.y
      ))

      if (!hasCollision) return candidate
    }
  }

  return {
    id,
    x: 0,
    y: clamp(Math.max(...layout.map((item) => item.y + item.h), 0), 0, DASHBOARD_GRID_MAX_ROWS - height),
    w: width,
    h: height,
    minW: CUSTOM_WIDGET_MIN_SIZE.w,
    minH: CUSTOM_WIDGET_MIN_SIZE.h,
  }
}

const readNumber = (value: unknown, fallback: number) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const serializeLayout = (layout: DashboardLayoutItem[]) => (
  JSON.stringify(
    layout
      .map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
)

const serializeWidgets = (widgets: DashboardCustomWidget[]) => (
  JSON.stringify(
    widgets
      .map(({ id, type, title, content }) => ({ id, type, title, content }))
      .sort((a, b) => a.id.localeCompare(b.id))
  )
)

const sanitizeWidgets = (widgets: unknown): DashboardCustomWidget[] => {
  if (!Array.isArray(widgets)) return []

  return widgets
    .filter((widget): widget is Record<string, unknown> => Boolean(widget) && typeof widget === 'object')
    .map((widget) => {
      const rawId = sanitizeText(widget.id)
      const id = isCustomCardId(rawId as DashboardCardId)
        ? rawId as DashboardCustomCardId
        : createCustomId()
      const type = widget.type === 'image' ? 'image' : 'text'

      return {
        id,
        type,
        title: sanitizeText(widget.title, type === 'image' ? '图片' : '文本').slice(0, 40),
        content: sanitizeWidgetContent(type, widget.content),
      }
    })
}

const sanitizeLayout = (
  layout: DashboardLayoutItem[] | null | undefined,
  widgets: DashboardCustomWidget[] = []
) => {
  const savedById = new Map<DashboardCardId, Partial<DashboardLayoutItem>>()
  const customDefaults = widgets.map((widget) => ({
    id: widget.id,
    x: 0,
    y: 0,
    w: CUSTOM_WIDGET_DEFAULT_SIZE.w,
    h: CUSTOM_WIDGET_DEFAULT_SIZE.h,
    minW: CUSTOM_WIDGET_MIN_SIZE.w,
    minH: CUSTOM_WIDGET_MIN_SIZE.h,
  }))
  const defaultLayout = [...DEFAULT_DASHBOARD_LAYOUT, ...customDefaults]

  layout?.forEach((item) => {
    if (defaultLayout.some((defaultItem) => defaultItem.id === item.id)) {
      savedById.set(item.id, item)
    }
  })

  const sanitizedLayout = defaultLayout.map((defaultItem) => {
    const saved = savedById.get(defaultItem.id)
    const width = clamp(readNumber(saved?.w, defaultItem.w), defaultItem.minW, DASHBOARD_GRID_COLUMNS)
    const height = clamp(readNumber(saved?.h, defaultItem.h), defaultItem.minH, DASHBOARD_GRID_MAX_ROWS)

    return {
      ...defaultItem,
      w: width,
      h: height,
      x: clamp(readNumber(saved?.x, defaultItem.x), 0, DASHBOARD_GRID_COLUMNS - width),
      y: clamp(readNumber(saved?.y, defaultItem.y), 0, DASHBOARD_GRID_MAX_ROWS - height),
    }
  })

  return sanitizedLayout.map((item) => (
    isCustomCardId(item.id) && !savedById.has(item.id)
      ? createCustomLayoutItem(item.id, sanitizedLayout.filter((layoutItem) => layoutItem.id !== item.id))
      : item
  ))
}

const readSavedSnapshot = (): DashboardLayoutSnapshot => {
  if (typeof window === 'undefined') {
    return { layout: cloneLayout(DEFAULT_DASHBOARD_LAYOUT), widgets: [] }
  }

  try {
    const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DashboardLayoutSnapshot>
      const widgets = sanitizeWidgets(parsed.widgets)
      return {
        layout: sanitizeLayout(parsed.layout, widgets),
        widgets,
      }
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY)
    if (legacyRaw) {
      return { layout: sanitizeLayout(JSON.parse(legacyRaw) as DashboardLayoutItem[]), widgets: [] }
    }

    return { layout: cloneLayout(DEFAULT_DASHBOARD_LAYOUT), widgets: [] }
  } catch (error) {
    console.warn('Failed to load dashboard layout:', error)
    return { layout: cloneLayout(DEFAULT_DASHBOARD_LAYOUT), widgets: [] }
  }
}

const hasLegacyDashboardSnapshot = () => {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.localStorage.getItem(DASHBOARD_LAYOUT_STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY)
  )
}

const removeLegacyDashboardSnapshot = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DASHBOARD_LAYOUT_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_DASHBOARD_LAYOUT_STORAGE_KEY)
}

const toPersistedDashboardSnapshot = (
  layout: DashboardLayoutItem[],
  widgets: DashboardCustomWidget[]
) => ({
  layout: JSON.parse(serializeLayout(layout)) as unknown,
  widgets: JSON.parse(serializeWidgets(widgets)) as unknown,
})

const parseDeviceDashboardSnapshot = (value: unknown): DashboardLayoutSnapshot | null => {
  if (!value || typeof value !== 'object') return null

  const candidate = value as { layout?: unknown; widgets?: unknown }
  if (!Array.isArray(candidate.layout) && !Array.isArray(candidate.widgets)) return null

  const widgets = sanitizeWidgets(candidate.widgets)
  const layout = Array.isArray(candidate.layout)
    ? sanitizeLayout(candidate.layout as DashboardLayoutItem[], widgets)
    : sanitizeLayout(undefined, widgets)

  return { layout, widgets }
}

export function DashboardLayoutProvider({ children }: { children: ReactNode }) {
  const [editMode, setEditMode] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState<DashboardLayoutSnapshot>(readSavedSnapshot)
  const [widgets, setWidgets] = useState<DashboardCustomWidget[]>(() => cloneWidgets(savedSnapshot.widgets))
  const [layout, setLayoutState] = useState<DashboardLayoutItem[]>(() => cloneLayout(savedSnapshot.layout))
  const [editingWidgetId, setEditingWidgetId] = useState<DashboardCustomCardId | null>(null)

  useEffect(() => {
    let cancelled = false

    api.getUiPreferences()
      .then((response) => {
        if (cancelled) return

        const deviceSnapshot = parseDeviceDashboardSnapshot(response.data?.dashboard_layout)
        const nextSnapshot = deviceSnapshot ?? readSavedSnapshot()

        setSavedSnapshot({
          layout: cloneLayout(nextSnapshot.layout),
          widgets: cloneWidgets(nextSnapshot.widgets),
        })
        setWidgets(cloneWidgets(nextSnapshot.widgets))
        setLayoutState(cloneLayout(nextSnapshot.layout))

        if (deviceSnapshot) {
          removeLegacyDashboardSnapshot()
          return
        }

        if (hasLegacyDashboardSnapshot()) {
          void api.updateUiPreferences({
            dashboard_layout: toPersistedDashboardSnapshot(nextSnapshot.layout, nextSnapshot.widgets),
          })
            .then(removeLegacyDashboardSnapshot)
            .catch((error) => console.warn('Failed to migrate dashboard layout:', error))
        }
      })
      .catch((error) => {
        console.warn('Failed to load dashboard layout from device:', error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const setLayout = useCallback((nextLayout: DashboardLayoutItem[]) => {
    setLayoutState(sanitizeLayout(nextLayout, widgets))
  }, [widgets])

  const addCustomWidget = useCallback((type: DashboardCustomWidgetType) => {
    const id = createCustomId()
    const widget: DashboardCustomWidget = {
      id,
      type,
      title: type === 'image' ? '图片' : '文本',
      content: '',
    }

    setWidgets((currentWidgets) => [...currentWidgets, widget])
    setLayoutState((currentLayout) => {
      const nextLayout = cloneLayout(currentLayout)
      return [...nextLayout, createCustomLayoutItem(id, nextLayout)]
    })
    setEditingWidgetId(id)
  }, [])

  const updateCustomWidget = useCallback((
    id: DashboardCustomCardId,
    patch: Partial<Omit<DashboardCustomWidget, 'id'>>
  ) => {
    setWidgets((currentWidgets) => currentWidgets.map((widget) => (
      widget.id === id
        ? (() => {
          const type = patch.type === 'image' || patch.type === 'text' ? patch.type : widget.type

          return {
            ...widget,
            ...patch,
            type,
            title: sanitizeText(patch.title, widget.title).slice(0, 40),
            content: sanitizeWidgetContent(type, patch.content, widget.content),
          }
        })()
        : widget
    )))
  }, [])

  const removeCustomWidget = useCallback((id: DashboardCustomCardId) => {
    setWidgets((currentWidgets) => currentWidgets.filter((widget) => widget.id !== id))
    setLayoutState((currentLayout) => currentLayout.filter((item) => item.id !== id))
    setEditingWidgetId((currentId) => (currentId === id ? null : currentId))
  }, [])

  const saveLayout = useCallback(() => {
    setLayoutState((currentLayout) => {
      const nextLayout = sanitizeLayout(currentLayout, widgets)
      const nextSnapshot = {
        layout: nextLayout,
        widgets,
      }
      setSavedSnapshot(nextSnapshot)

      void api.updateUiPreferences({
        dashboard_layout: toPersistedDashboardSnapshot(nextLayout, widgets),
      })
        .then(removeLegacyDashboardSnapshot)
        .catch((error) => console.warn('Failed to save dashboard layout:', error))

      return cloneLayout(nextLayout)
    })
    setEditMode(false)
    setEditingWidgetId(null)
  }, [widgets])

  const resetLayout = useCallback(() => {
    setWidgets(cloneWidgets(savedSnapshot.widgets))
    setLayoutState(cloneLayout(savedSnapshot.layout))
    setEditMode(false)
    setEditingWidgetId(null)
  }, [savedSnapshot])

  const isDirty = serializeLayout(layout) !== serializeLayout(savedSnapshot.layout) ||
    serializeWidgets(widgets) !== serializeWidgets(savedSnapshot.widgets)

  const value = useMemo(
    () => ({
      editMode,
      setEditMode,
      isDirty,
      layout,
      setLayout,
      widgets,
      addCustomWidget,
      updateCustomWidget,
      removeCustomWidget,
      editingWidgetId,
      setEditingWidgetId,
      saveLayout,
      resetLayout,
    }),
    [
      addCustomWidget,
      editMode,
      editingWidgetId,
      isDirty,
      layout,
      removeCustomWidget,
      resetLayout,
      saveLayout,
      setLayout,
      updateCustomWidget,
      widgets,
    ]
  )

  return (
    <DashboardLayoutContext.Provider value={value}>
      {children}
    </DashboardLayoutContext.Provider>
  )
}

export const useDashboardLayout = () => {
  const context = useContext(DashboardLayoutContext)
  if (!context) {
    throw new Error('useDashboardLayout must be used within DashboardLayoutProvider')
  }
  return context
}
