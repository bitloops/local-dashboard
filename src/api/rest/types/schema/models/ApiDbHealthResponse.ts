/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { ApiBackendHealthDto } from './ApiBackendHealthDto'
export type ApiDbHealthResponse = {
  clickhouse: ApiBackendHealthDto
  events: ApiBackendHealthDto
  postgres: ApiBackendHealthDto
  relational: ApiBackendHealthDto
}
