export const CODE_CITY_LIVE_DATASET_ID = 'live-devql-current'

export function isLiveCodeCityDataset(datasetId: string): boolean {
  return datasetId === CODE_CITY_LIVE_DATASET_ID
}
