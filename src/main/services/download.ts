/**
 * Compatibility entry point: the download engine lives in `src/main/util/download.ts`.
 * Services import it from here so the public service surface stays stable.
 */
export {
  MAX_CONCURRENCY,
  downloadFile,
  downloadFiles,
  sha1File,
} from '../util/download'
export type { DownloadFileInput, DownloadFilesOptions, DownloadProgress } from '../util/download'
