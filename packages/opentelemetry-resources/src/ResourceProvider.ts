/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Resource } from "./Resource";

/**
 * ResourceProvider provides a central place for retrieving the current Resource. This makes it
 * possible to update the resource that is attached to new signals.
 */
export class ResourceProvider {
  static readonly DEFAULT = new ResourceProvider();

  private _resource: Resource;

  constructor(resource?: Resource) {
    this._resource = resource ?? Resource.empty();
    this._resource = Resource.default().merge(this._resource);
  }

  getResource(): Resource {
    return this._resource;
  }

  updateResource(resource: Resource): void {
    this._resource = resource;
  }
}
