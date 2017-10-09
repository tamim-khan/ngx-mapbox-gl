import {
  EventData,
  FlyToOptions,
  LngLatBoundsLike,
  LngLatLike,
  Map,
  MapboxOptions,
  MapBoxZoomEvent,
  MapMouseEvent,
  MapTouchEvent,
  PaddingOptions,
  PointLike,
  Style
} from 'mapbox-gl';
import 'rxjs/add/operator/first';
import { MapService } from './map.service';
import {
    AfterViewInit,
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    ContentChild,
    ElementRef,
    EmbeddedViewRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    SimpleChanges,
    TemplateRef,
    ViewChild,
} from '@angular/core';
import { MapEvent } from './map.types';

declare global {
  namespace mapboxgl {
    export interface MapboxOptions {
      failIfMajorPerformanceCaveat?: boolean;
      transformRequest?: Function;
      localIdeographFontFamily?: string;
      pitchWithRotate?: boolean;
    }
  }
}

@Component({
  selector: 'mgl-map',
  // NOTE: Using a container seems mandatory instead of using this.ElementRef.nativeElement
  // Otherwise for some reason *ngIf inside the template doesn't work
  // As long as we attach the view to the ApplicationRef (in order to not have the map element in the dom)
  // Doing this.viewContainerRef.createEmbeddedView(this.templateRef) works (like ngTemplateOutlet)
  // and does not require this extra container, but doing this way, components (even empty) are in the dom...
  template: '<div #container></div>',
  styles: [`
  div {
    height: 100%
  }
  `],
  providers: [
    MapService
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapComponent implements OnChanges, OnDestroy, AfterViewInit, MapboxOptions, MapEvent {
  /* Init inputs */
  @Input() accessToken?: string;
  @Input() customMapboxApiUrl?: string;
  @Input() hash?: boolean;
  @Input() refreshExpiredTiles?: boolean;
  @Input() failIfMajorPerformanceCaveat?: boolean;
  @Input() classes?: string[];
  @Input() bearingSnap?: number;
  @Input() interactive?: boolean;
  @Input() pitchWithRotate?: boolean;
  @Input() attributionControl?: boolean;
  @Input() logoPosition?: any; // @types/mapbox-gl issue, should be 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  @Input() maxTileCacheSize?: number;
  @Input() localIdeographFontFamily?: string;
  @Input() preserveDrawingBuffer?: boolean;
  @Input() renderWorldCopies?: boolean;
  @Input() trackResize?: boolean;
  @Input() transformRequest?: Function;

  /* Dynamic inputs */
  @Input() minZoom?: number;
  @Input() maxZoom?: number;
  @Input() scrollZoom?: boolean;
  @Input() dragRotate?: boolean;
  @Input() touchZoomRotate?: boolean;
  @Input() doubleClickZoom?: boolean;
  @Input() keyboard?: boolean;
  @Input() dragPan?: boolean;
  @Input() boxZoom?: boolean;
  @Input() style: Style | string;
  @Input() center?: LngLatLike;
  @Input() zoom?: number;
  @Input() maxBounds?: LngLatBoundsLike;
  @Input() bearing?: number;
  @Input() pitch?: number;

  /* Added by ngx-mapbox-gl */
  @Input() movingMethod: 'jumpTo' | 'easeTo' | 'flyTo' = 'flyTo';
  @Input() fitBounds?: LngLatBoundsLike;
  @Input() fitBoundsOptions?: {
    linear?: boolean,
    easing?: Function,
    padding?: number | PaddingOptions,
    offset?: PointLike, maxZoom?: number
  };
  @Input() flyToOptions?: FlyToOptions;

  @Output() resize = new EventEmitter<void>();
  @Output() remove = new EventEmitter<void>();
  @Output() mouseDown = new EventEmitter<MapMouseEvent>();
  @Output() mouseUp = new EventEmitter<MapMouseEvent>();
  @Output() mouseMove = new EventEmitter<MapMouseEvent>();
  @Output() click = new EventEmitter<MapMouseEvent>();
  @Output() dblClick = new EventEmitter<MapMouseEvent>();
  @Output() mouseEnter = new EventEmitter<MapMouseEvent>();
  @Output() mouseLeave = new EventEmitter<MapMouseEvent>();
  @Output() mouseOver = new EventEmitter<MapMouseEvent>();
  @Output() mouseOut = new EventEmitter<MapMouseEvent>();
  @Output() contextMenu = new EventEmitter<MapMouseEvent>();
  @Output() touchStart = new EventEmitter<MapTouchEvent>();
  @Output() touchEnd = new EventEmitter<MapTouchEvent>();
  @Output() touchMove = new EventEmitter<MapTouchEvent>();
  @Output() touchCancel = new EventEmitter<MapTouchEvent>();
  @Output() moveStart = new EventEmitter<DragEvent>(); // TODO Check type
  @Output() move = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() moveEnd = new EventEmitter<DragEvent>();
  @Output() dragStart = new EventEmitter<DragEvent>();
  @Output() drag = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() dragEnd = new EventEmitter<DragEvent>();
  @Output() zoomStart = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() zoomChange = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() zoomEnd = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() rotateStart = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() rotate = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() rotateEnd = new EventEmitter<MapTouchEvent | MapMouseEvent>();
  @Output() pitchStart = new EventEmitter<EventData>();
  @Output() pitchChange = new EventEmitter<EventData>();
  @Output() pitchEnd = new EventEmitter<EventData>();
  @Output() boxZoomStart = new EventEmitter<MapBoxZoomEvent>();
  @Output() boxZoomEnd = new EventEmitter<MapBoxZoomEvent>();
  @Output() boxZoomCancel = new EventEmitter<MapBoxZoomEvent>();
  @Output() webGlContextLost = new EventEmitter<void>();
  @Output() webGlContextRestored = new EventEmitter<void>();
  @Output() load = new EventEmitter<any>();
  @Output() render = new EventEmitter<void>();
  @Output() error = new EventEmitter<any>(); // TODO Check type
  @Output() data = new EventEmitter<EventData>();
  @Output() styleData = new EventEmitter<EventData>();
  @Output() sourceData = new EventEmitter<EventData>();
  @Output() dataLoading = new EventEmitter<EventData>();
  @Output() styleDataLoading = new EventEmitter<EventData>();
  @Output() sourceDataLoading = new EventEmitter<EventData>();

  @ContentChild(TemplateRef) templateRef?: TemplateRef<void>;

  get mapInstance(): Map {
    return this.MapService.mapInstance;
  }

  @ViewChild('container') mapContainer: ElementRef;

  private mapElementsView: EmbeddedViewRef<void>;

  constructor(
    private ApplicationRef: ApplicationRef,
    private MapService: MapService
  ) { }

  ngAfterViewInit() {
    if (this.templateRef) {
      this.mapElementsView = this.templateRef.createEmbeddedView(undefined);
      this.load.first().subscribe(() => {
        this.mapElementsView.detectChanges();
        this.ApplicationRef.attachView(this.mapElementsView);
      });
    }
    this.MapService.setup({
      accessToken: this.accessToken,
      customMapboxApiUrl: this.customMapboxApiUrl,
      mapOptions: {
        container: this.mapContainer.nativeElement,
        minZoom: this.minZoom,
        maxZoom: this.maxZoom,
        style: this.style,
        hash: this.hash,
        interactive: this.interactive,
        bearingSnap: this.bearingSnap,
        pitchWithRotate: this.pitchWithRotate,
        classes: this.classes,
        attributionControl: this.attributionControl,
        logoPosition: this.logoPosition,
        failIfMajorPerformanceCaveat: this.failIfMajorPerformanceCaveat,
        preserveDrawingBuffer: this.preserveDrawingBuffer,
        refreshExpiredTiles: this.refreshExpiredTiles,
        maxBounds: this.maxBounds,
        scrollZoom: this.scrollZoom,
        boxZoom: this.boxZoom,
        dragRotate: this.dragRotate,
        dragPan: this.dragPan,
        keyboard: this.keyboard,
        doubleClickZoom: this.doubleClickZoom,
        touchZoomRotate: this.touchZoomRotate,
        trackResize: this.trackResize,
        center: this.center,
        zoom: this.zoom,
        bearing: this.bearing,
        pitch: this.pitch,
        renderWorldCopies: this.renderWorldCopies,
        maxTileCacheSize: this.maxTileCacheSize,
        localIdeographFontFamily: this.localIdeographFontFamily,
        transformRequest: this.transformRequest
      },
      mapEvents: this
    });
  }

  ngOnDestroy() {
    if (this.mapElementsView) {
      this.mapElementsView.destroy();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.minZoom && !changes.minZoom.isFirstChange()) {
      this.MapService.updateMinZoom(changes.minZoom.currentValue);
    }
    if (changes.maxZoom && !changes.maxZoom.isFirstChange()) {
      this.MapService.updateMaxZoom(changes.maxZoom.currentValue);
    }
    if (changes.scrollZoom && !changes.scrollZoom.isFirstChange()) {
      this.MapService.updateScrollZoom(changes.scrollZoom.currentValue);
    }
    if (changes.dragRotate && !changes.dragRotate.isFirstChange()) {
      this.MapService.updateDragRotate(changes.dragRotate.currentValue);
    }
    if (changes.touchZoomRotate && !changes.touchZoomRotate.isFirstChange()) {
      this.MapService.updateTouchZoomRotate(changes.touchZoomRotate.currentValue);
    }
    if (changes.doubleClickZoom && !changes.doubleClickZoom.isFirstChange()) {
      this.MapService.updateDoubleClickZoom(changes.doubleClickZoom.currentValue);
    }
    if (changes.keyboard && !changes.keyboard.isFirstChange()) {
      this.MapService.updateKeyboard(changes.keyboard.currentValue);
    }
    if (changes.dragPan && !changes.dragPan.isFirstChange()) {
      this.MapService.updateDragPan(changes.dragPan.currentValue);
    }
    if (changes.boxZoom && !changes.boxZoom.isFirstChange()) {
      this.MapService.updateBoxZoom(changes.boxZoom.currentValue);
    }
    if (changes.style && !changes.style.isFirstChange()) {
      this.MapService.updateStyle(changes.style.currentValue);
    }
    if (changes.maxBounds && !changes.maxBounds.isFirstChange()) {
      this.MapService.updateMaxBounds(changes.maxBounds.currentValue);
    }
    if (
      changes.center && !changes.center.isFirstChange() ||
      changes.zoom && !changes.zoom.isFirstChange() ||
      changes.bearing && !changes.bearing.isFirstChange() ||
      changes.pitch && !changes.pitch.isFirstChange()
    ) {
      this.MapService.move(
        this.movingMethod,
        this.flyToOptions,
        this.zoom,
        this.center,
        this.bearing,
        this.pitch
      );
    }
  }

}
