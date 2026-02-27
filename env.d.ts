/// <reference types="vite/client" />

import 'pinia'

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S, Store> {
    persist?: boolean | object
  }
  export interface DefineSetupStoreOptions<Id, S, G, A> {
    persist?: boolean | object
  }
}
