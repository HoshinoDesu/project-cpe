import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Box, IconButton, useTheme, type Theme } from '@mui/material'
import { Delete, DragIndicator, Edit } from '@mui/icons-material'
import { alpha } from '@/utils/theme'
import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_GRID_MAX_ROWS,
  DEFAULT_DASHBOARD_LAYOUT,
  isCustomCardId,
  useDashboardLayout,
  type DashboardCardId,
  type DashboardLayoutItem,
} from '@/contexts/DashboardLayoutContext'
import { useFullDashboardLayout } from '../hooks/useFullDashboardLayout'

const GRID_ROW_HEIGHT = 72
const GRID_GAP = 16
const MIN_CONTENT_SCALE = 0.35
const TILE_MOTION_DURATION_MS = 240
const TILE_MOTION_STAGGER_MS = 110
const TILE_MOTION_EASING = 'cubic-bezier(0.2, 0, 0, 1)'
const MAX_GRID_HEIGHT = DASHBOARD_GRID_MAX_ROWS * GRID_ROW_HEIGHT + (DASHBOARD_GRID_MAX_ROWS - 1) * GRID_GAP
const GRID_BACKDROP_CELLS = Array.from(
  { length: DASHBOARD_GRID_COLUMNS * DASHBOARD_GRID_MAX_ROWS },
  (_, index) => index
)
const CARD_ORDER = DEFAULT_DASHBOARD_LAYOUT.map((item) => item.id)
const DEFAULT_CARD_MIN_SIZE = new Map(
  DEFAULT_DASHBOARD_LAYOUT.map((item) => [item.id, { minW: item.minW, minH: item.minH }])
)

type GestureType = 'drag' | 'resize'
type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

interface DashboardLayoutGridProps {
  items: Record<string, ReactNode>
}

interface GridMetrics {
  columnWidth: number
  columnStep: number
  rowHeight: number
  rowStep: number
}

interface LayoutGesture {
  type: GestureType
  corner?: ResizeCorner
  pointerId: number
  startX: number
  startY: number
  latestX: number
  latestY: number
  latestClientX: number
  latestClientY: number
  startItem: DashboardLayoutItem
  startLayout: DashboardLayoutItem[]
}

interface LayoutPreview {
  id: DashboardCardId
  transformX: number
  transformY: number
  width?: number
  height?: number
}

interface LayoutAnimationSnapshot {
  activeId: DashboardCardId | null
  rects: Map<DashboardCardId, DOMRect>
}

interface SwapLandingPair {
  active: DashboardLayoutItem
  target: DashboardLayoutItem
}

const resizeHandles: Array<{
  corner: ResizeCorner
  sx: Record<string, unknown>
  cursor: string
}> = [
  {
    corner: 'nw',
    cursor: 'nwse-resize',
    sx: { top: 4, left: 4, borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '8px 0 0 0' },
  },
  {
    corner: 'ne',
    cursor: 'nesw-resize',
    sx: { top: 4, right: 4, borderTopWidth: 3, borderRightWidth: 3, borderRadius: '0 8px 0 0' },
  },
  {
    corner: 'sw',
    cursor: 'nesw-resize',
    sx: { bottom: 4, left: 4, borderBottomWidth: 3, borderLeftWidth: 3, borderRadius: '0 0 0 8px' },
  },
  {
    corner: 'se',
    cursor: 'nwse-resize',
    sx: { right: 4, bottom: 4, borderRightWidth: 3, borderBottomWidth: 3, borderRadius: '0 0 8px 0' },
  },
]

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const layoutSignature = (layout: DashboardLayoutItem[]) => (
  layout
    .map((item) => `${item.id}:${item.x},${item.y},${item.w},${item.h}`)
    .sort()
    .join('|')
)

const sortByPosition = (layout: DashboardLayoutItem[]) => (
  [...layout].sort((a, b) => a.y - b.y || a.x - b.x || getCardOrderIndex(a.id) - getCardOrderIndex(b.id))
)

const sortByCardOrder = (layout: DashboardLayoutItem[]) => (
  [...layout].sort((a, b) => getCardOrderIndex(a.id) - getCardOrderIndex(b.id))
)

const getCardOrderIndex = (id: DashboardCardId) => {
  const index = CARD_ORDER.indexOf(id)
  return index === -1 ? CARD_ORDER.length : index
}

const getItemWidth = (item: DashboardLayoutItem, metrics: GridMetrics) => (
  item.w * metrics.columnWidth + Math.max(item.w - 1, 0) * GRID_GAP
)

const getItemHeight = (item: DashboardLayoutItem, metrics: GridMetrics) => (
  item.h * metrics.rowHeight + Math.max(item.h - 1, 0) * GRID_GAP
)

const getItemMinSize = (item: DashboardLayoutItem) => {
  const defaultMinSize = DEFAULT_CARD_MIN_SIZE.get(item.id)

  return {
    minW: Math.max(item.minW, defaultMinSize?.minW ?? item.minW),
    minH: Math.max(item.minH, defaultMinSize?.minH ?? item.minH),
  }
}

const normalizeItem = (item: DashboardLayoutItem): DashboardLayoutItem => {
  const { minW, minH } = getItemMinSize(item)
  const width = clamp(Math.round(item.w), minW, DASHBOARD_GRID_COLUMNS)
  const height = clamp(Math.round(item.h), minH, DASHBOARD_GRID_MAX_ROWS)

  return {
    ...item,
    minW,
    minH,
    w: width,
    h: height,
    x: clamp(Math.round(item.x), 0, DASHBOARD_GRID_COLUMNS - width),
    y: clamp(Math.round(item.y), 0, DASHBOARD_GRID_MAX_ROWS - height),
  }
}

const collides = (a: DashboardLayoutItem, b: DashboardLayoutItem) => (
  a.id !== b.id &&
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y
)

const hasCollision = (
  layout: DashboardLayoutItem[],
  item: DashboardLayoutItem,
  ignoreIds: DashboardCardId[] = []
) => layout.some((layoutItem) => !ignoreIds.includes(layoutItem.id) && collides(layoutItem, item))

const rangeOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
  return overlap > 0 ? overlap : 0
}

const buildLinePositions = (
  max: number,
  span: number,
  anchorStart: number,
  anchorSpan: number
) => (
  Array.from({ length: max + 1 }, (_, value) => value).sort((a, b) => {
    const aOverlap = rangeOverlap(a, a + span, anchorStart, anchorStart + anchorSpan)
    const bOverlap = rangeOverlap(b, b + span, anchorStart, anchorStart + anchorSpan)

    if (aOverlap !== bOverlap) return bOverlap - aOverlap

    const anchorCenter = anchorStart + anchorSpan / 2
    const aDistance = Math.abs(a + span / 2 - anchorCenter)
    const bDistance = Math.abs(b + span / 2 - anchorCenter)

    return aDistance - bDistance || a - b
  })
)

const buildLandingCandidates = (
  item: DashboardLayoutItem,
  anchor: DashboardLayoutItem
) => {
  const maxX = DASHBOARD_GRID_COLUMNS - item.w
  const maxY = DASHBOARD_GRID_MAX_ROWS - item.h
  const candidates: Array<{ x: number; y: number }> = []
  const seen = new Set<string>()
  const addCandidate = (x: number, y: number) => {
    const candidateX = clamp(Math.round(x), 0, maxX)
    const candidateY = clamp(Math.round(y), 0, maxY)
    const key = `${candidateX}:${candidateY}`

    if (!seen.has(key)) {
      seen.add(key)
      candidates.push({ x: candidateX, y: candidateY })
    }
  }

  addCandidate(anchor.x, anchor.y)

  const rowY = clamp(anchor.y, 0, maxY)
  buildLinePositions(maxX, item.w, anchor.x, anchor.w).forEach((x) => addCandidate(x, rowY))

  const columnX = clamp(anchor.x, 0, maxX)
  buildLinePositions(maxY, item.h, anchor.y, anchor.h).forEach((y) => addCandidate(columnX, y))

  return candidates
}

const buildLandingItem = (
  item: DashboardLayoutItem,
  position: { x: number; y: number }
) => {
  const candidate = normalizeItem({ ...item, x: position.x, y: position.y })

  return candidate.x === position.x && candidate.y === position.y ? candidate : null
}

const canPlaceItem = (
  layout: DashboardLayoutItem[],
  item: DashboardLayoutItem,
  ignoreIds: DashboardCardId[],
  extraBlockedItems: DashboardLayoutItem[] = []
) => (
  !hasCollision(layout, item, ignoreIds) &&
  !extraBlockedItems.some((blockedItem) => collides(item, blockedItem))
)

const getAnchorOverlap = (item: DashboardLayoutItem, anchor: DashboardLayoutItem) => (
  rangeOverlap(item.x, item.x + item.w, anchor.x, anchor.x + anchor.w) *
  rangeOverlap(item.y, item.y + item.h, anchor.y, anchor.y + anchor.h)
)

const getAnchorDistance = (item: DashboardLayoutItem, anchor: DashboardLayoutItem) => (
  Math.abs(item.x + item.w / 2 - (anchor.x + anchor.w / 2)) +
  Math.abs(item.y + item.h / 2 - (anchor.y + anchor.h / 2))
)

const findSwapLandingPair = (
  layout: DashboardLayoutItem[],
  activeItem: DashboardLayoutItem,
  swapTarget: DashboardLayoutItem,
  activeStartItem: DashboardLayoutItem
): SwapLandingPair | null => {
  const ignoreIds = [activeItem.id, swapTarget.id]
  const activeCandidates = buildLandingCandidates(activeItem, swapTarget)
  const targetCandidates = buildLandingCandidates(swapTarget, activeStartItem)
  let bestPair: SwapLandingPair | null = null
  let bestScore = Number.POSITIVE_INFINITY

  activeCandidates.forEach((activePosition, activeIndex) => {
    const activeCandidate = buildLandingItem(activeItem, activePosition)
    if (!activeCandidate || !canPlaceItem(layout, activeCandidate, ignoreIds)) return

    targetCandidates.forEach((targetPosition, targetIndex) => {
      const targetCandidate = buildLandingItem(swapTarget, targetPosition)
      if (!targetCandidate || !canPlaceItem(layout, targetCandidate, ignoreIds, [activeCandidate])) return

      const anchorOverlap = getAnchorOverlap(activeCandidate, swapTarget) +
        getAnchorOverlap(targetCandidate, activeStartItem)
      const anchorDistance = getAnchorDistance(activeCandidate, swapTarget) +
        getAnchorDistance(targetCandidate, activeStartItem)
      const score = activeIndex + targetIndex - anchorOverlap * 2 + anchorDistance * 0.08

      if (score < bestScore) {
        bestScore = score
        bestPair = {
          active: activeCandidate,
          target: targetCandidate,
        }
      }
    })
  })

  return bestPair
}

const buildResizeItem = (
  startItem: DashboardLayoutItem,
  deltaColumns: number,
  deltaRows: number,
  corner: ResizeCorner
) => {
  const { minW, minH } = getItemMinSize(startItem)
  const right = startItem.x + startItem.w
  const bottom = startItem.y + startItem.h
  let x = startItem.x
  let y = startItem.y
  let w = startItem.w
  let h = startItem.h

  if (corner.includes('w')) {
    x = clamp(startItem.x + deltaColumns, 0, right - minW)
    w = right - x
  } else {
    w = clamp(startItem.w + deltaColumns, minW, DASHBOARD_GRID_COLUMNS - startItem.x)
  }

  if (corner.includes('n')) {
    y = clamp(startItem.y + deltaRows, 0, bottom - minH)
    h = bottom - y
  } else {
    h = clamp(startItem.h + deltaRows, minH, DASHBOARD_GRID_MAX_ROWS - startItem.y)
  }

  return normalizeItem({ ...startItem, minW, minH, x, y, w, h })
}

const buildFinalItem = (gesture: LayoutGesture, metrics: GridMetrics) => {
  const deltaColumns = Math.round((gesture.latestX - gesture.startX) / metrics.columnStep)
  const deltaRows = Math.round((gesture.latestY - gesture.startY) / metrics.rowStep)
  const startItem = gesture.startItem

  if (gesture.type === 'drag') {
    return normalizeItem({
      ...startItem,
      x: clamp(startItem.x + deltaColumns, 0, DASHBOARD_GRID_COLUMNS - startItem.w),
      y: clamp(startItem.y + deltaRows, 0, DASHBOARD_GRID_MAX_ROWS - startItem.h),
    })
  }

  return buildResizeItem(startItem, deltaColumns, deltaRows, gesture.corner ?? 'se')
}

const getOverlapArea = (a: DashboardLayoutItem, b: DashboardLayoutItem) => {
  const width = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)

  return width > 0 && height > 0 ? width * height : 0
}

const getPrimaryCollision = (
  layout: DashboardLayoutItem[],
  activeId: DashboardCardId,
  item: DashboardLayoutItem
) => (
  layout
    .filter((layoutItem) => layoutItem.id !== activeId)
    .map((layoutItem) => ({
      item: layoutItem,
      overlap: getOverlapArea(layoutItem, item),
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.item.y - b.item.y || a.item.x - b.item.x)[0]?.item
)

const resolveLayout = (
  layout: DashboardLayoutItem[],
  activeId: DashboardCardId,
  nextActiveItem: DashboardLayoutItem,
  gestureType: GestureType
) => {
  const normalizedActiveItem = normalizeItem(nextActiveItem)
  const activeStartItem = layout.find((item) => item.id === activeId)
  if (!activeStartItem) return layout

  if (gestureType === 'resize') {
    return hasCollision(layout, normalizedActiveItem, [activeId])
      ? layout
      : sortByCardOrder(layout.map((item) => (item.id === activeId ? normalizedActiveItem : item)))
  }

  const swapTarget = gestureType === 'drag'
    ? getPrimaryCollision(layout, activeId, normalizedActiveItem)
    : undefined
  const activeIgnoreIds = swapTarget ? [activeId, swapTarget.id] : [activeId]
  const activeHasCollision = hasCollision(layout, normalizedActiveItem, activeIgnoreIds)

  if (!swapTarget) {
    return activeHasCollision
      ? layout
      : sortByCardOrder(layout.map((item) => (item.id === activeId ? normalizedActiveItem : item)))
  }

  const swapPair = findSwapLandingPair(layout, normalizedActiveItem, swapTarget, activeStartItem)

  if (!swapPair) {
    return layout
  }

  return sortByCardOrder(layout.map((item) => {
    if (item.id === activeId) return swapPair.active
    if (item.id === swapPair.target.id) return swapPair.target
    return item
  }))
}

const buildPreview = (gesture: LayoutGesture, metrics: GridMetrics): LayoutPreview => {
  const dx = gesture.latestX - gesture.startX
  const dy = gesture.latestY - gesture.startY
  const item = gesture.startItem

  if (gesture.type === 'drag') {
    return {
      id: item.id,
      transformX: dx,
      transformY: dy,
    }
  }

  const deltaColumns = Math.round(dx / metrics.columnStep)
  const deltaRows = Math.round(dy / metrics.rowStep)
  const snapItem = buildResizeItem(item, deltaColumns, deltaRows, gesture.corner ?? 'se')

  return {
    id: item.id,
    transformX: (snapItem.x - item.x) * metrics.columnStep,
    transformY: (snapItem.y - item.y) * metrics.rowStep,
    width: getItemWidth(snapItem, metrics),
    height: getItemHeight(snapItem, metrics),
  }
}

const getScaleTarget = (content: HTMLDivElement) => (
  content.querySelector<HTMLElement>(
    ':scope > .MuiCard-root > .MuiCardContent-root, :scope > .MuiPaper-root > .MuiCardContent-root'
  ) ?? content
)

function AutoFitDashboardCard({
  children,
  active,
}: {
  children: ReactNode
  active: boolean
}) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const scaleRef = useRef(1)
  const measureFrameRef = useRef<number | undefined>(undefined)
  const [scale, setScale] = useState(1)

  const measure = useCallback(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return

    const target = getScaleTarget(content)
    const frameRect = frame.getBoundingClientRect()

    if (frameRect.width <= 0 || frameRect.height <= 0) return

    const previousInlineStyle = {
      width: target.style.width,
      height: target.style.height,
      minHeight: target.style.minHeight,
      transform: target.style.transform,
      transition: target.style.transition,
    }

    target.style.width = '100%'
    target.style.height = '100%'
    target.style.minHeight = '100%'
    target.style.transform = 'none'
    target.style.transition = 'none'

    const contentWidth = Math.max(target.scrollWidth, target.offsetWidth, 1)
    const contentHeight = Math.max(target.scrollHeight, target.offsetHeight, 1)

    target.style.width = previousInlineStyle.width
    target.style.height = previousInlineStyle.height
    target.style.minHeight = previousInlineStyle.minHeight
    target.style.transform = previousInlineStyle.transform
    target.style.transition = previousInlineStyle.transition

    const nextScale = clamp(
      Math.min(1, frameRect.width / contentWidth, frameRect.height / contentHeight),
      MIN_CONTENT_SCALE,
      1
    )

    if (Math.abs(scaleRef.current - nextScale) >= 0.01) {
      scaleRef.current = nextScale
      setScale(nextScale)
    }
  }, [])

  useEffect(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return undefined

    const scheduleMeasure = () => {
      if (measureFrameRef.current !== undefined) {
        window.cancelAnimationFrame(measureFrameRef.current)
      }

      measureFrameRef.current = window.requestAnimationFrame(() => {
        measureFrameRef.current = undefined
        measure()
      })
    }

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(scheduleMeasure)
    const mutationObserver = typeof MutationObserver === 'undefined'
      ? undefined
      : new MutationObserver(scheduleMeasure)

    resizeObserver?.observe(frame)
    resizeObserver?.observe(content)
    mutationObserver?.observe(content, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })
    window.addEventListener('resize', scheduleMeasure)
    scheduleMeasure()

    return () => {
      if (measureFrameRef.current !== undefined) {
        window.cancelAnimationFrame(measureFrameRef.current)
        measureFrameRef.current = undefined
      }
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
    }
  }, [children, measure])

  return (
    <Box
      ref={frameRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        ref={contentRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: '100%',
          '& > .MuiCard-root, & > .MuiPaper-root': {
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          },
          '& > .MuiCard-root > .MuiCardContent-root, & > .MuiPaper-root > .MuiCardContent-root': {
            width: scale < 1 ? `${100 / scale}%` : '100%',
            height: scale < 1 ? `${100 / scale}%` : '100%',
            minHeight: scale < 1 ? `${100 / scale}%` : '100%',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            transition: active ? 'none' : 'transform 140ms ease',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export function DashboardLayoutGrid({ items }: DashboardLayoutGridProps) {
  const theme = useTheme<Theme>()
  const fullLayout = useFullDashboardLayout()
  const {
    editMode,
    layout,
    removeCustomWidget,
    setEditingWidgetId,
    setLayout,
  } = useDashboardLayout()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const tileRefs = useRef(new Map<DashboardCardId, HTMLDivElement>())
  const tileMotionRefs = useRef(new Map<DashboardCardId, HTMLDivElement>())
  const gestureRef = useRef<LayoutGesture | null>(null)
  const previewFrameRef = useRef<number | undefined>(undefined)
  const layoutAnimationRef = useRef<LayoutAnimationSnapshot | null>(null)
  const tileAnimationsRef = useRef(new Map<DashboardCardId, Animation>())
  const [activeId, setActiveId] = useState<DashboardCardId | null>(null)
  const [preview, setPreview] = useState<LayoutPreview | null>(null)

  const visibleLayout = useMemo(
    () => (fullLayout ? layout : DEFAULT_DASHBOARD_LAYOUT),
    [fullLayout, layout]
  )
  const sortedLayout = useMemo(() => sortByPosition(visibleLayout), [visibleLayout])
  const canEditLayout = editMode && fullLayout

  const getGridMetrics = useCallback((): GridMetrics | null => {
    const container = containerRef.current
    if (!container) return null

    const rect = container.getBoundingClientRect()
    const columnWidth = (rect.width - GRID_GAP * (DASHBOARD_GRID_COLUMNS - 1)) / DASHBOARD_GRID_COLUMNS

    return {
      columnWidth,
      columnStep: columnWidth + GRID_GAP,
      rowHeight: GRID_ROW_HEIGHT,
      rowStep: GRID_ROW_HEIGHT + GRID_GAP,
    }
  }, [])

  const schedulePreview = useCallback(() => {
    if (previewFrameRef.current !== undefined) return

    previewFrameRef.current = window.requestAnimationFrame(() => {
      previewFrameRef.current = undefined
      const gesture = gestureRef.current
      const metrics = getGridMetrics()
      if (!gesture || !metrics) return

      setPreview(buildPreview(gesture, metrics))
    })
  }, [getGridMetrics])

  const captureLayoutAnimation = useCallback((commitActiveId: DashboardCardId | null) => {
    const rects = new Map<DashboardCardId, DOMRect>()

    tileMotionRefs.current.forEach((node, id) => {
      rects.set(id, node.getBoundingClientRect())
    })

    layoutAnimationRef.current = {
      activeId: commitActiveId,
      rects,
    }
  }, [])

  const clearGesture = useCallback(() => {
    gestureRef.current = null
    setActiveId(null)
    setPreview(null)

    if (previewFrameRef.current !== undefined) {
      window.cancelAnimationFrame(previewFrameRef.current)
      previewFrameRef.current = undefined
    }
  }, [])

  const startGesture = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    item: DashboardLayoutItem,
    type: GestureType,
    corner?: ResizeCorner
  ) => {
    if (!canEditLayout || event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)

    const startX = event.clientX + window.scrollX
    const startY = event.clientY + window.scrollY
    const gesture: LayoutGesture = {
      type,
      corner,
      pointerId: event.pointerId,
      startX,
      startY,
      latestX: startX,
      latestY: startY,
      latestClientX: event.clientX,
      latestClientY: event.clientY,
      startItem: { ...item },
      startLayout: layout.map((layoutItem) => ({ ...layoutItem })),
    }
    const metrics = getGridMetrics()

    gestureRef.current = gesture
    setActiveId(item.id)
    if (metrics) {
      setPreview(buildPreview(gesture, metrics))
    }
  }, [canEditLayout, getGridMetrics, layout])

  useLayoutEffect(() => {
    const snapshot = layoutAnimationRef.current
    if (!snapshot) return

    layoutAnimationRef.current = null

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    snapshot.rects.forEach((previousRect, id) => {
      const node = tileMotionRefs.current.get(id)
      if (!node) return

      const nextRect = node.getBoundingClientRect()
      const deltaX = previousRect.left - nextRect.left
      const deltaY = previousRect.top - nextRect.top
      const scaleX = previousRect.width > 0 && nextRect.width > 0 ? previousRect.width / nextRect.width : 1
      const scaleY = previousRect.height > 0 && nextRect.height > 0 ? previousRect.height / nextRect.height : 1
      const didMove = Math.abs(deltaX) > 0.5 || Math.abs(deltaY) > 0.5
      const didResize = Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01

      if (!didMove && !didResize) return

      tileAnimationsRef.current.get(id)?.cancel()

      const isActiveCommit = id === snapshot.activeId
      const animation = node.animate(
        [
          {
            transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`,
            transformOrigin: 'top left',
          },
          {
            transform: 'translate3d(0, 0, 0) scale(1, 1)',
            transformOrigin: 'top left',
          },
        ],
        {
          duration: isActiveCommit ? TILE_MOTION_DURATION_MS : TILE_MOTION_DURATION_MS + 70,
          delay: isActiveCommit ? 0 : TILE_MOTION_STAGGER_MS,
          easing: TILE_MOTION_EASING,
          fill: 'both',
        }
      )

      tileAnimationsRef.current.set(id, animation)
      animation.onfinish = () => {
        if (tileAnimationsRef.current.get(id) === animation) {
          tileAnimationsRef.current.delete(id)
        }
      }
      animation.oncancel = animation.onfinish
    })
  }, [layout])

  useEffect(() => () => {
    tileAnimationsRef.current.forEach((animation) => animation.cancel())
    tileAnimationsRef.current.clear()
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return

      event.preventDefault()
      gesture.latestClientX = event.clientX
      gesture.latestClientY = event.clientY
      gesture.latestX = event.clientX + window.scrollX
      gesture.latestY = event.clientY + window.scrollY
      schedulePreview()
    }

    const handleScroll = () => {
      const gesture = gestureRef.current
      if (!gesture) return

      gesture.latestX = gesture.latestClientX + window.scrollX
      gesture.latestY = gesture.latestClientY + window.scrollY
      schedulePreview()
    }

    const handlePointerUp = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture || gesture.pointerId !== event.pointerId) return

      const metrics = getGridMetrics()
      const moved = Math.abs(gesture.latestX - gesture.startX) > 3 ||
        Math.abs(gesture.latestY - gesture.startY) > 3

      if (metrics && moved) {
        const nextItem = buildFinalItem(gesture, metrics)
        const nextLayout = resolveLayout(gesture.startLayout, gesture.startItem.id, nextItem, gesture.type)
        if (layoutSignature(nextLayout) !== layoutSignature(layout)) {
          captureLayoutAnimation(gesture.startItem.id)
          setLayout(nextLayout)
        }
      }

      clearGesture()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [captureLayoutAnimation, clearGesture, getGridMetrics, layout, schedulePreview, setLayout])

  useEffect(() => {
    if (!canEditLayout) {
      const frame = window.requestAnimationFrame(clearGesture)
      return () => window.cancelAnimationFrame(frame)
    }

    return undefined
  }, [canEditLayout, clearGesture])

  return (
    <Box
      ref={containerRef}
      sx={{
        display: 'grid',
        gridTemplateColumns: fullLayout ? `repeat(${DASHBOARD_GRID_COLUMNS}, minmax(0, 1fr))` : '1fr',
        gridAutoRows: fullLayout ? `${GRID_ROW_HEIGHT}px` : 'auto',
        gap: 2,
        mb: 2,
        minHeight: canEditLayout ? `${MAX_GRID_HEIGHT}px` : 'auto',
        alignItems: 'stretch',
        position: 'relative',
        transition: canEditLayout ? 'min-height 180ms ease' : 'none',
      }}
    >
      {canEditLayout && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${DASHBOARD_GRID_COLUMNS}, minmax(0, 1fr))`,
            gridAutoRows: `${GRID_ROW_HEIGHT}px`,
            gap: 2,
            pointerEvents: 'none',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: -1,
              border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.28 : 0.18)}`,
              borderRadius: 1.5,
            },
          }}
        >
          {GRID_BACKDROP_CELLS.map((cell) => (
            <Box
              key={cell}
              sx={{
                borderRadius: 1,
                border: `1px solid ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.12)}`,
                bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.035 : 0.028),
              }}
            />
          ))}
        </Box>
      )}
      {sortedLayout.map((item) => {
        const isActive = activeId === item.id
        const customId = isCustomCardId(item.id) ? item.id : null
        const activePreview = preview?.id === item.id ? preview : null
        const transform = activePreview
          ? `translate3d(${activePreview.transformX}px, ${activePreview.transformY}px, 0)`
          : 'none'

        return (
          <Box
            key={item.id}
            ref={(node: HTMLDivElement | null) => {
              if (node) {
                tileRefs.current.set(item.id, node)
              } else {
                tileRefs.current.delete(item.id)
              }
            }}
            sx={{
              position: 'relative',
              zIndex: isActive ? 8 : 1,
              minWidth: 0,
              width: activePreview?.width ? `${activePreview.width}px` : 'auto',
              height: activePreview?.height ? `${activePreview.height}px` : 'auto',
              gridColumn: fullLayout ? `${item.x + 1} / span ${item.w}` : '1 / -1',
              gridRow: fullLayout ? `${item.y + 1} / span ${item.h}` : 'auto',
              minHeight: fullLayout
                ? activePreview?.height
                  ? `${activePreview.height}px`
                  : item.h * GRID_ROW_HEIGHT + (item.h - 1) * GRID_GAP
                : 'auto',
              transform,
              willChange: isActive ? 'transform, width, height' : 'auto',
              transition: isActive && activePreview?.width
                ? `width 150ms ${TILE_MOTION_EASING}, height 150ms ${TILE_MOTION_EASING}, min-height 150ms ${TILE_MOTION_EASING}`
                : 'none',
            }}
          >
            <Box
              ref={(node: HTMLDivElement | null) => {
                if (node) {
                  tileMotionRefs.current.set(item.id, node)
                } else {
                  tileMotionRefs.current.delete(item.id)
                }
              }}
              sx={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '100%',
                filter: isActive ? `drop-shadow(0 18px 24px ${alpha(theme.palette.common.black, 0.18)})` : 'none',
                willChange: isActive ? 'filter' : 'auto',
                transition: isActive ? 'filter 140ms ease' : 'none',
              }}
            >
              <AutoFitDashboardCard active={isActive}>
                {items[item.id]}
              </AutoFitDashboardCard>

              {canEditLayout && (
                <>
                  <Box
                    onPointerDown={(event) => startGesture(event, item, 'drag')}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 2,
                      borderRadius: 2,
                      cursor: isActive ? 'grabbing' : 'grab',
                      touchAction: 'none',
                      border: `1px dashed ${alpha(theme.palette.primary.main, isActive ? 0.9 : 0.55)}`,
                      bgcolor: alpha(theme.palette.primary.main, isActive ? 0.1 : 0.045),
                      boxShadow: isActive ? `0 0 0 3px ${alpha(theme.palette.primary.main, 0.14)}` : 'none',
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      zIndex: 3,
                      width: 28,
                      height: 28,
                      display: 'grid',
                      placeItems: 'center',
                      borderRadius: 1,
                      color: 'primary.main',
                      bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.74 : 0.86),
                      pointerEvents: 'none',
                    }}
                  >
                    <DragIndicator fontSize="small" />
                  </Box>
                  {resizeHandles.map((handle) => (
                    <Box
                      key={handle.corner}
                      onPointerDown={(event) => startGesture(event, item, 'resize', handle.corner)}
                      sx={{
                        position: 'absolute',
                        zIndex: 4,
                        width: 26,
                        height: 26,
                        cursor: handle.cursor,
                        touchAction: 'none',
                        borderStyle: 'solid',
                        borderColor: alpha(theme.palette.primary.main, 0.76),
                        borderWidth: 0,
                        bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.48 : 0.62),
                        ...handle.sx,
                      }}
                    />
                  ))}
                  {customId && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <IconButton
                        size="small"
                        title="编辑内容"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditingWidgetId(customId)
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'primary.main',
                          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.78 : 0.9),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.paper, 1),
                          },
                        }}
                      >
                        <Edit sx={{ fontSize: 17 }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        title="删除内容"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          removeCustomWidget(customId)
                        }}
                        sx={{
                          width: 28,
                          height: 28,
                          color: 'error.main',
                          bgcolor: alpha(theme.palette.background.paper, theme.palette.mode === 'dark' ? 0.78 : 0.9),
                          '&:hover': {
                            bgcolor: alpha(theme.palette.background.paper, 1),
                          },
                        }}
                      >
                        <Delete sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
