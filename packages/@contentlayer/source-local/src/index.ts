import type { Cache, Options, SourcePlugin } from '@contentlayer/core'
import { casesHandled } from '@contentlayer/utils'
import * as chokidar from 'chokidar'
import type { Observable } from 'rxjs'
import { defer, fromEvent, of } from 'rxjs'
import { map, mergeMap, startWith, tap } from 'rxjs/operators'

import { fetchAllDocuments, getDocumentDefNameWithRelativeFilePathArray, makeDocumentFromFilePath } from './fetchData'
import { makeCoreSchema } from './provideSchema'
import type { DocumentDef, Thunk } from './schema'
import type { FilePathPatternMap } from './types'

export * from './schema'
export * from './types'

type Args = {
  schema: Thunk<DocumentDef>[] | Record<string, Thunk<DocumentDef>>
  contentDirPath: string
} & Options &
  Partial<Flags>

export type Flags = {
  /**
   * Whether to print warning meassages if content has fields not definied in the schema
   * @default 'warn'
   */
  onExtraData: 'warn' | 'ignore'
  /**
   * Whether to skip or fail when encountering missing or incompatible data
   */
  onMissingOrIncompatibleData: 'skip' | 'fail' | 'skip-ignore'
}

type MakeSourcePlugin = (_: Args | (() => Args) | (() => Promise<Args>)) => Promise<SourcePlugin>

export const fromLocalContent: MakeSourcePlugin = async (_args) => {
  const {
    contentDirPath,
    schema: documentDefs_,
    onMissingOrIncompatibleData = 'skip',
    onExtraData = 'warn',
    ...options
  } = typeof _args === 'function' ? await _args() : _args
  const documentDefs = (Array.isArray(documentDefs_) ? documentDefs_ : Object.values(documentDefs_)).map((_) => _())

  return {
    type: 'local',
    provideSchema: () => makeCoreSchema({ documentDefs }),
    fetchData: ({ watch }) => {
      const filePathPatternMap = documentDefs.reduce(
        (acc, documentDef) => ({ ...acc, [documentDef.name]: documentDef.filePathPattern }),
        {} as FilePathPatternMap,
      )
      const flags: Flags = { onExtraData, onMissingOrIncompatibleData }

      const schemaDef = makeCoreSchema({ documentDefs })
      const initEvent: CustomUpdateEventInit = { _tag: 'init' }

      let cache: Cache | undefined = undefined

      const updates$: Observable<CustomUpdateEvent> = watch
        ? defer(
            () =>
              fromEvent(
                chokidar.watch('.', {
                  cwd: contentDirPath,
                  ignoreInitial: true,
                  // Unfortunately needed in order to avoid race conditions
                  awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 10 },
                }),
                'all',
              ) as Observable<ChokidarAllEvent>,
          ).pipe(
            map(chokidarAllEventToCustomUpdateEvent),
            tap(
              (e) =>
                (e._tag === 'update' || e._tag === 'deleted') &&
                console.log(`Watch event "${e._tag}": ${e.relativeFilePath}`),
            ),
            startWith(initEvent),
          )
        : of(initEvent)

      return updates$
        .pipe(
          mergeMap((event) => {
            switch (event._tag) {
              case 'init':
                return fetchAllDocuments({ schemaDef, filePathPatternMap, contentDirPath, flags, options })
              case 'deleted': {
                cache!.documents = cache!.documents.filter((_) => _._id !== event.relativeFilePath)
                return of(cache!)
              }
              case 'update': {
                return defer(async () => {
                  const documentDefNameWithFilePathArray = await getDocumentDefNameWithRelativeFilePathArray({
                    contentDirPath,
                    filePathPatternMap,
                  })
                  const documentDefName = documentDefNameWithFilePathArray.find(
                    (_) => _.relativeFilePath === event.relativeFilePath,
                  )?.documentDefName

                  if (!documentDefName) {
                    console.log(`No matching document def found for ${event.relativeFilePath}`)
                    return cache!
                  }

                  const document = await makeDocumentFromFilePath({
                    contentDirPath,
                    documentDefName,
                    relativeFilePath: event.relativeFilePath,
                    flags,
                    schemaDef,
                    options,
                  })

                  if (document) {
                    cache!.documents = cache!.documents.filter((_) => _._id !== event.relativeFilePath)
                    cache!.documents.push(document)
                  }

                  return cache!
                })
              }
              default:
                casesHandled(event)
            }
          }),
        )
        .pipe(
          tap((cache_) => {
            cache = cache_
          }),
        )
    },
  }
}

const chokidarAllEventToCustomUpdateEvent = ([eventName, relativeFilePath]: ChokidarAllEvent): CustomUpdateEvent => {
  switch (eventName) {
    case 'add':
    case 'change':
      return { _tag: 'update', relativeFilePath }
    case 'unlink':
      return { _tag: 'deleted', relativeFilePath }
    case 'unlinkDir':
    case 'addDir':
      return { _tag: 'init' }
    default:
      casesHandled(eventName)
  }
}

type ChokidarAllEvent = [eventName: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir', path: string, stats?: any]

type CustomUpdateEvent = CustomUpdateEventFileUpdated | CustomUpdateEventFileDeleted | CustomUpdateEventInit

type CustomUpdateEventFileUpdated = {
  readonly _tag: 'update'
  relativeFilePath: string
}

type CustomUpdateEventFileDeleted = {
  readonly _tag: 'deleted'
  relativeFilePath: string
}

type CustomUpdateEventInit = {
  readonly _tag: 'init'
}
