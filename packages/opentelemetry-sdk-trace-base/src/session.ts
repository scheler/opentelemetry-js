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

import { Resource, ResourceProvider, ResourceAttributes } from '@opentelemetry/resources';

export class SessionProvider {
    private readonly _sessionManagers: Map<string, SessionManager> = new Map();
    readonly resourceProvider: ResourceProvider;

    constructor(resourceProvider: ResourceProvider) {
        this.resourceProvider = resourceProvider;
    }

    addSessionManager(name: string, sessionManager: SessionManager) {
        this._sessionManagers.set(name, sessionManager);
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
    load(name: string): SessionContext | null;
    delete(name: string): void;
}

export class CookiesSessionPersister {
    private _maxAge: number | undefined;

    constructor(maxAge?: number) {
        this._maxAge = maxAge;
    }

    save(name: string, sessionContext: SessionContext): void {
        let cookieContent = `${SessionContext.getKey(name)}=${sessionContext.getId()}`;
        if (this._maxAge !== undefined) {
            cookieContent += `;max-age=${this._maxAge}`;
        }
        document.cookie = cookieContent;
    }

    load(name: string): SessionContext | null {
        const cookie = CookiesSessionPersister.getCookie(SessionContext.getKey(name));
        if (cookie) {
            return new SessionContext(cookie);
        }
        return null;
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
    private _name: string;
    private _sessionContext: SessionContext | null = null;
    private _sessionPersister: SessionPersister;
    private _resourceProvider: ResourceProvider;

    constructor(name: string, resourceProvider: ResourceProvider, sessionPersister: SessionPersister) {
        this._name = name ?? 'default';
        this._sessionPersister = sessionPersister || new CookiesSessionPersister();
        this._resourceProvider = resourceProvider;

        this._sessionContext = this._sessionPersister.load(this._name);
        if (this._sessionContext != null) {
            this.updateResource();
        }
    }

    get hasActiveSession() {
        return this._sessionContext != null;
    }

    createSession(): void {
        this.endSession();
        this._sessionContext = new SessionContext();
        this._sessionPersister?.save(this._name, this._sessionContext);

        this.updateResource();
    }

    endSession(): void {
        const attributes: ResourceAttributes = this._resourceProvider.getResource().attributes;
        delete attributes[SessionContext.getKey(this._name)];

        this.updateResource();
    }

    private updateResource() {
        if (this._sessionContext && this._name) {
            const resource: Resource = this._resourceProvider.getResource().merge(
                new Resource(this._sessionContext.get(this._name) as ResourceAttributes));
            this._resourceProvider.updateResource(resource);
        }
    }
}

export class SimpleSessionManager extends SessionManager{
    constructor(name: string, resourceProvider: ResourceProvider, timeoutSeconds: number) {
        super(name, resourceProvider, new CookiesSessionPersister(timeoutSeconds));
    }
}
