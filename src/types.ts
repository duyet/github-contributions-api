export type Level = 0 | 1 | 2 | 3 | 4

export type Contribution = {
  date: string
  count: number
  level: Level
}

export type Total = {
  [year: string]: number
}

export type FlatResponse = {
  total: Total
  contributions: Contribution[]
}

export type NestedContributions = {
  [year: string]: {
    [month: string]: {
      [day: string]: Contribution
    }
  }
}

export type NestedResponse = {
  total: Total
  contributions: NestedContributions
}

export type ApiResponse = FlatResponse | NestedResponse

export type ErrorResponse = {
  error: string
  issues?: Array<{
    code: string
    path: string
    message: string
  }>
}

export type QueryParams = {
  y: 'all' | 'last' | number[]
  format?: 'nested'
}
