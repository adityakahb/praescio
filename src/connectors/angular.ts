/**
 * @module praescio/connectors/angular
 *
 * Angular connector for Praescio — a framework-agnostic base class that
 * encapsulates the create/update/destroy lifecycle. In an Angular project,
 * extend this class and apply the standard Angular decorators from
 * `@angular/core`.
 *
 * @peerDependency @angular/core ≥ 15
 *
 * @example Complete Angular standalone directive
 * ```ts
 * // praescio.directive.ts
 * import {
 *   Directive,
 *   Input,
 *   ElementRef,
 *   OnInit,
 *   OnChanges,
 *   OnDestroy,
 * } from '@angular/core';
 * import { PraescioDirectiveBase } from 'praescio/connectors';
 * import type { PraescioOptions } from 'praescio';
 *
 * @Directive({ selector: '[praescio]', standalone: true })
 * export class PraescioDirective<T = unknown>
 *   extends PraescioDirectiveBase<T>
 *   implements OnInit, OnChanges, OnDestroy
 * {
 *   // Bind options via attribute: <input [praescio]="opts" />
 *   @Input('praescio') override options!: PraescioOptions<T>;
 *
 *   constructor(private host: ElementRef<HTMLInputElement>) {
 *     super();
 *   }
 *
 *   ngOnInit(): void {
 *     this.init(this.host.nativeElement);
 *   }
 *
 *   ngOnChanges(): void {
 *     this.reinit(this.host.nativeElement);
 *   }
 *
 *   ngOnDestroy(): void {
 *     this.teardown();
 *   }
 * }
 * ```
 *
 * @example Template
 * ```html
 * <input [praescio]="{ source: countries, onSelect: onCountrySelect }"
 *        placeholder="Search countries…" />
 * ```
 *
 * @example Register in an NgModule (non-standalone)
 * ```ts
 * import { NgModule } from '@angular/core';
 * import { PraescioDirective } from './praescio.directive';
 *
 * @NgModule({ declarations: [PraescioDirective], exports: [PraescioDirective] })
 * export class PraescioModule {}
 * ```
 */

import type { PraescioOptions } from '../types/PraescioOptions';
import type { PraescioPublicAPI } from '../types/Plugin';
import { Praescio } from '../core/Praescio';

/**
 * Framework-agnostic base class that manages the Praescio lifecycle.
 *
 * Subclass this in your Angular project and delegate the Angular lifecycle
 * hooks (`ngOnInit`, `ngOnChanges`, `ngOnDestroy`) to the corresponding
 * protected methods ({@link init}, {@link reinit}, {@link teardown}).
 *
 * @typeParam T - Raw item type returned by the data source.
 */
export class PraescioDirectiveBase<T = unknown> {
  /**
   * Praescio configuration options.
   *
   * In an Angular directive, annotate this with `@Input('praescio')` so the
   * consumer can bind options directly on the element attribute.
   */
  options!: PraescioOptions<T>;

  private _instance: PraescioPublicAPI | null = null;

  /**
   * The current Praescio instance, or `null` if the directive has not been
   * initialised yet (or has been destroyed).
   */
  get instance(): PraescioPublicAPI | null {
    return this._instance;
  }

  /**
   * Create and mount the Praescio instance on `element`.
   *
   * If an instance already exists it is destroyed first, making successive
   * calls safe (e.g. when `ngOnInit` races with `ngOnChanges`).
   *
   * Call from `ngOnInit`.
   *
   * @param element - The host `<input>` element obtained from `ElementRef`.
   */
  protected init(element: HTMLElement): void {
    if (this._instance) {
      this._instance.destroy();
    }
    this._instance = new Praescio<T>(element, this.options);
  }

  /**
   * Destroy the current instance and create a fresh one with the latest
   * options. This is the correct response to Angular `@Input` changes.
   *
   * Call from `ngOnChanges`.
   *
   * @param element - The host `<input>` element obtained from `ElementRef`.
   */
  protected reinit(element: HTMLElement): void {
    this.teardown();
    this.init(element);
  }

  /**
   * Destroy the Praescio instance and clean up all DOM and event-listener
   * side-effects.
   *
   * Call from `ngOnDestroy`. Safe to call even if `init` was never called.
   */
  protected teardown(): void {
    this._instance?.destroy();
    this._instance = null;
  }
}
