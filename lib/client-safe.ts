/**
 * Boundary mappers for Server → Client component props.
 *
 * Prisma returns `Decimal` objects for money columns. RSC serialization only
 * accepts plain objects, so any Decimal that crosses into a `'use client'`
 * component throws "Decimal objects are not supported". These helpers convert
 * the money fields to plain numbers at the server boundary.
 */

export function toClientMoney(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function woToClient<T extends { laborCost?: unknown; partsCost?: unknown }>(
  wo: T
): T & { laborCost: number | null; partsCost: number | null } {
  return {
    ...wo,
    laborCost: toClientMoney(wo.laborCost),
    partsCost: toClientMoney(wo.partsCost),
  }
}

export function partToClient<T extends { unitCost?: unknown }>(
  part: T
): T & { unitCost: number | null } {
  return { ...part, unitCost: toClientMoney(part.unitCost) }
}

export function bomTemplateToClient<T extends {
  parts?: Array<{ part: { unitCost?: unknown } | null | undefined }>
}>(
  template: T
): T & {
  parts: Array<{ part: ({ unitCost?: unknown } & { unitCost: number | null }) | null | undefined }>
} {
  return {
    ...template,
    parts: (template.parts ?? []).map((p) => ({ ...p, part: p.part ? partToClient(p.part) : p.part })),
  }
}
