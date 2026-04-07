/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */

import type { BaseHttpRequest } from './core/BaseHttpRequest'
import type { OpenAPIConfig } from './core/OpenAPI'
import { FetchHttpRequest } from './core/FetchHttpRequest'
import { SuperHandlersBundleService } from './services/SuperHandlersBundleService'
import { SuperHandlersCheckpointService } from './services/SuperHandlersCheckpointService'
import { SuperHandlersDashboardService } from './services/SuperHandlersDashboardService'
import { SuperHandlersHealthService } from './services/SuperHandlersHealthService'
import { SuperHandlersMetaService } from './services/SuperHandlersMetaService'
type HttpRequestConstructor = new (config: OpenAPIConfig) => BaseHttpRequest
export class BitloopsCli {
  public readonly superHandlersBundle: SuperHandlersBundleService
  public readonly superHandlersCheckpoint: SuperHandlersCheckpointService
  public readonly superHandlersDashboard: SuperHandlersDashboardService
  public readonly superHandlersHealth: SuperHandlersHealthService
  public readonly superHandlersMeta: SuperHandlersMetaService
  public readonly request: BaseHttpRequest
  constructor(
    config?: Partial<OpenAPIConfig>,
    HttpRequest: HttpRequestConstructor = FetchHttpRequest,
  ) {
    this.request = new HttpRequest({
      BASE: config?.BASE ?? '',
      VERSION: config?.VERSION ?? '0.0.12',
      WITH_CREDENTIALS: config?.WITH_CREDENTIALS ?? false,
      CREDENTIALS: config?.CREDENTIALS ?? 'include',
      TOKEN: config?.TOKEN,
      USERNAME: config?.USERNAME,
      PASSWORD: config?.PASSWORD,
      HEADERS: config?.HEADERS,
      ENCODE_PATH: config?.ENCODE_PATH,
    })
    this.superHandlersBundle = new SuperHandlersBundleService(this.request)
    this.superHandlersCheckpoint = new SuperHandlersCheckpointService(
      this.request,
    )
    this.superHandlersDashboard = new SuperHandlersDashboardService(
      this.request,
    )
    this.superHandlersHealth = new SuperHandlersHealthService(this.request)
    this.superHandlersMeta = new SuperHandlersMetaService(this.request)
  }
}
