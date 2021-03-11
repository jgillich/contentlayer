import { Cache, Document } from './data'

export type GetDocumentTypeMapGen = SourcebitGen extends { typeMap: infer T } ? T : Record<string, Document>
export type GetDocumentTypeGen<Name extends keyof GetDocumentTypeMapGen> = GetDocumentTypeMapGen[Name]
export type GetDocumentTypesGen = SourcebitGen extends { types: infer T } ? T : Document
export type GetDocumentTypeNamesGen = SourcebitGen extends { typeNames: infer T } ? T : string

declare global {
  // NOTE will be extended via `node_modules/@types/sourcebit-gen/index.d.ts`
  interface SourcebitGen {}
}

export type CacheGen = Omit<Cache, 'documents'> & { documents: DocumentGen[] }

export type DocumentGen = GetDocumentTypesGen
