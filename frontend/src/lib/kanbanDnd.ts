import type { DragEndEvent } from '@dnd-kit/core'

type KanbanColumnKey = string
type KanbanComparableScalar = boolean | number | string | null | undefined
type KanbanComparableRecord = Record<string, KanbanComparableScalar>
type KanbanComparableValue = KanbanComparableRecord | KanbanComparableScalar

export type DropDetail<TColumnKey extends KanbanColumnKey = KanbanColumnKey> = {
  itemId: string
  columnKey: TColumnKey
  kanban_order: number | null
}

export type KanbanDndConfig<
  TItem extends { id: string } & Record<string, unknown>,
  TColumnKey extends KanbanColumnKey = KanbanColumnKey,
> = {
  columnIdPrefix: string
  cardIdPrefix: string
  getColumnKey: (item: TItem) => TColumnKey
  getOrder: (item: TItem) => number | null
  setColumnAndOrder: (
    item: TItem,
    column: TColumnKey,
    order: number | null,
  ) => TItem
  orderItemsInColumn: (items: TItem[], column: TColumnKey) => TItem[]
}

function readValueFromPrefixedId(value: string, prefix: string): string | null {
  return value.startsWith(prefix) ? value.slice(prefix.length) : null
}

function findItemById<TItem extends { id: string }>(
  items: TItem[],
  itemId: string,
): TItem | undefined {
  return items.find((item) => item.id === itemId)
}

function cloneWithOrder<TItem extends { id: string } & Record<string, unknown>>(
  item: TItem,
  order: number,
): TItem {
  return {
    ...item,
    kanban_order: order,
  }
}

function getOrderedColumnItems<
  TItem extends { id: string } & Record<string, unknown>,
  TColumnKey extends KanbanColumnKey,
>(
  items: TItem[],
  activeItemId: string,
  columnKey: TColumnKey,
  config: KanbanDndConfig<TItem, TColumnKey>,
): TItem[] {
  return config.orderItemsInColumn(
    items.filter(
      (item) => config.getColumnKey(item) === columnKey && item.id !== activeItemId,
    ),
    columnKey,
  )
}

function isComparableRecord(
  value: KanbanComparableValue,
): value is KanbanComparableRecord {
  return typeof value === 'object' && value !== null
}

function areComparableValuesEqual(
  left: KanbanComparableValue,
  right: KanbanComparableValue,
): boolean {
  if (isComparableRecord(left) || isComparableRecord(right)) {
    if (!isComparableRecord(left) || !isComparableRecord(right)) {
      return false
    }

    const leftKeys = Object.keys(left)
    const rightKeys = Object.keys(right)
    if (leftKeys.length !== rightKeys.length) {
      return false
    }

    return leftKeys.every((key) => Object.is(left[key], right[key]))
  }

  return Object.is(left, right)
}

export function hasKanbanComparableChanged<
  TItem extends { id: string },
  TComparable extends KanbanComparableValue,
>(
  previousItems: TItem[],
  nextItems: TItem[],
  getComparableValue: (item: TItem) => TComparable,
): boolean {
  const previousSnapshot = new Map(
    previousItems.map((item) => [item.id, getComparableValue(item)]),
  )
  const nextSnapshot = new Map(
    nextItems.map((item) => [item.id, getComparableValue(item)]),
  )

  if (previousSnapshot.size !== nextSnapshot.size) {
    return true
  }

  for (const [itemId, nextValue] of nextSnapshot) {
    const previousValue = previousSnapshot.get(itemId)
    if (previousValue === undefined) {
      return true
    }

    if (!areComparableValuesEqual(previousValue, nextValue)) {
      return true
    }
  }

  return false
}

export function reorderKanbanItems<
  TItem extends { id: string } & Record<string, unknown>,
  TColumnKey extends KanbanColumnKey,
>(
  items: TItem[],
  itemId: string,
  nextColumn: TColumnKey,
  nextKanbanOrder: number | null,
  config: KanbanDndConfig<TItem, TColumnKey>,
): TItem[] {
  const movedItem = findItemById(items, itemId)
  if (!movedItem) {
    return items
  }

  const sourceColumn = getOrderedColumnItems(
    items,
    itemId,
    config.getColumnKey(movedItem),
    config,
  )
  const targetColumn = getOrderedColumnItems(items, itemId, nextColumn, config)
  const insertionIndex =
    nextKanbanOrder === null
      ? targetColumn.length
      : Math.max(0, Math.min(nextKanbanOrder, targetColumn.length))

  targetColumn.splice(
    insertionIndex,
    0,
    config.setColumnAndOrder(movedItem, nextColumn, insertionIndex),
  )

  const sourceOrders = new Map(
    sourceColumn.map((columnItem, index) => [columnItem.id, index]),
  )
  const targetOrders = new Map(
    targetColumn.map((columnItem, index) => [columnItem.id, index]),
  )

  return items.map((item) => {
    const targetOrder = targetOrders.get(item.id)
    if (targetOrder !== undefined) {
      const targetItem = findItemById(targetColumn, item.id) ?? item
      return cloneWithOrder(targetItem, targetOrder)
    }

    const sourceOrder = sourceOrders.get(item.id)
    if (sourceOrder !== undefined) {
      return cloneWithOrder(item, sourceOrder)
    }

    return item
  })
}

export function getDropDetailFromDragEvent<
  TItem extends { id: string } & Record<string, unknown>,
  TColumnKey extends KanbanColumnKey,
>(
  items: TItem[],
  event: DragEndEvent,
  config: KanbanDndConfig<TItem, TColumnKey>,
): DropDetail<TColumnKey> | null {
  if (!event.over) {
    return null
  }

  const activeItemId = readValueFromPrefixedId(
    String(event.active.id),
    config.cardIdPrefix,
  )
  if (!activeItemId) {
    return null
  }

  const activeItem = findItemById(items, activeItemId)
  if (!activeItem) {
    return null
  }

  const overId = String(event.over.id)
  const overCardItemId = readValueFromPrefixedId(overId, config.cardIdPrefix)
  const overColumnKey = readValueFromPrefixedId(overId, config.columnIdPrefix) as
    | TColumnKey
    | null

  let nextColumnKey: TColumnKey | null = null
  let nextKanbanOrder: number | null = null

  if (overCardItemId) {
    const overItem = findItemById(items, overCardItemId)
    if (!overItem) {
      return null
    }

    nextColumnKey = config.getColumnKey(overItem)
    const targetColumn = getOrderedColumnItems(
      items,
      activeItemId,
      nextColumnKey,
      config,
    )
    const insertionIndex = targetColumn.findIndex((item) => item.id === overCardItemId)
    nextKanbanOrder =
      insertionIndex < 0 ? targetColumn.length : insertionIndex
  } else if (overColumnKey !== null) {
    nextColumnKey = overColumnKey
    nextKanbanOrder = getOrderedColumnItems(
      items,
      activeItemId,
      overColumnKey,
      config,
    ).length
  }

  if (nextColumnKey === null) {
    return null
  }

  const nextItems = reorderKanbanItems(
    items,
    activeItemId,
    nextColumnKey,
    nextKanbanOrder,
    config,
  )

  if (
    !hasKanbanComparableChanged(items, nextItems, (item) => ({
      columnKey: config.getColumnKey(item),
      kanban_order: config.getOrder(item),
    }))
  ) {
    return null
  }

  return {
    itemId: activeItem.id,
    columnKey: nextColumnKey,
    kanban_order: nextKanbanOrder,
  }
}
