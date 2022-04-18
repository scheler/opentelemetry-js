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

import { Resource, ResourceAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider } from './BasicTracerProvider';

export class SessionProvider {
    private readonly _sessionManagers: Map<string, SessionManager> = new Map();

    addSessionManager(name: string, sessionManager: SessionManager) {
        this._sessionManagers.set(name, sessionManager);
    }

    // Register with each provider separately.
    register(tracerProvider: BasicTracerProvider): void {
        for (const [name, sessionManager] of this._sessionManagers) {
            sessionManager.attach(name, tracerProvider);
        }
    }
}

export class SessionContext {

    private readonly id: string;

    private _generate_session_id(): string {
        return '' + (Math.floor(Math.random() * 100) + 1);
    }

    constructor(id?: string) {
        this.id = id ?? this._generate_session_id();
    }

    getId(): string {
        return this.id;
    }

    get(name: string): object{
        const key = SessionContext.getKey(name);
        return {[key]: this.id};
    }

    static getKey(name: string): string {
        return `session.${name}.id`;
    }

}

export interface SessionPersister {
    save(name: string, sessionContext: SessionContext): void;
    load(name: string): SessionContext;
    delete(name: string): void;
}

export class CookiesSessionPersister {
    save(name: string, sessionContext: SessionContext): void {
        document.cookie = `${SessionContext.getKey(name)}=${sessionContext.getId()}`;

    }
    load(name: string): SessionContext {
        return new SessionContext(CookiesSessionPersister.getCookie(SessionContext.getKey(name)));
    }
    delete(name: string): void {
        CookiesSessionPersister.deleteCookie(SessionContext.getKey(name));
    }

    private static getCookie(name: string) : string | undefined {
        const value = '; ' + document.cookie;
        const parts = value.split('; ' + name + '=');

        if (parts.length === 2) {
            return parts.pop()?.split(';').shift();
        }
        return undefined;
    }

    private static deleteCookie(name: string): void {
        const date = new Date();

        // Set it expire in -1 days
        date.setTime(date.getTime() + (-1 * 24 * 60 * 60 * 1000));

        // Set it
        document.cookie = name + '=; expires=' + date.toUTCString() + '; path=/';
    }
}

export class BrowserSessionStorageSessionPersister {
    save(_name: string, _sessionContext: SessionContext): void {

    }
    load(_name: string): SessionContext {
        return new SessionContext();
    }
    delete(_name: string): void {
    }

}

export class SessionManager {

    private _name: string | null = null;
    private _sessionContext: SessionContext | null = null;
    private _tracerProvider?: BasicTracerProvider;
    private _sessionPersister: SessionPersister;

    constructor(sessionPersister: SessionPersister) {
        this._sessionPersister = sessionPersister || new CookiesSessionPersister();
    }

    attach(name: string, tracerProvider: BasicTracerProvider) {
        this._name = name;
        this._tracerProvider = tracerProvider;

        this._sessionContext = this._sessionPersister.load(this._name) || new SessionContext();
        this.updateResource();
    }

    createSession(): void {
        if (this._tracerProvider == null || this._name == null) {
            return;
        }

        this.endSession();
        this._sessionContext = new SessionContext();
        this._sessionPersister?.save(this._name, this._sessionContext);

        this.updateResource();
    }

    endSession(): void {
        if (this._tracerProvider == null || this._name == null) {
            return;
        }

        const attributes: ResourceAttributes = this._tracerProvider.resource.attributes;
        delete attributes[SessionContext.getKey(this._name)];
        this._tracerProvider.updateResource(new Resource(attributes));
    }

    private updateResource() {
        if (this._tracerProvider && this._sessionContext && this._name) {
            const resource: Resource = this._tracerProvider.resource.merge(
                                     new Resource(this._sessionContext.get(this._name) as ResourceAttributes));
            this._tracerProvider.updateResource(resource);
        }
    }
}

export class SimpleSessionManager extends SessionManager{
    constructor() {
        super(new CookiesSessionPersister());
        setTimeout(() =>  this.reset(), 15000);
    }

    reset() {
        super.endSession();
        super.createSession();
    }
}
