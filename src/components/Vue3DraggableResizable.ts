import {
  defineComponent,
  ref,
  toRef,
  h,
  Ref,
  inject,
  onUnmounted,
  watch,
} from "vue";
import {
  initDraggableContainer,
  watchProps,
  initState,
  initParent,
  initLimitSizeAndMethods,
  initResizeHandle,
} from "./hooks";
import "./index.css";
import { getElSize, filterHandles, IDENTITY } from "./utils";
import {
  UpdatePosition,
  GetPositionStore,
  ResizingHandle,
  ContainerProvider,
  SetMatchedLine,
} from "./types";

export const ALL_HANDLES: ResizingHandle[] = [
  "tl",
  "tm",
  "tr",
  "ml",
  "mr",
  "bl",
  "bm",
  "br",
];

const VdrProps = {
  initW: {
    type: Number,
    default: null,
  },
  initH: {
    type: Number,
    default: null,
  },
  w: {
    type: Number,
    default: 0,
  },
  h: {
    type: Number,
    default: 0,
  },
  x: {
    type: Number,
    default: 0,
  },
  y: {
    type: Number,
    default: 0,
  },
  draggable: {
    type: Boolean,
    default: true,
  },
  resizable: {
    type: Boolean,
    default: true,
  },
  disabledX: {
    type: Boolean,
    default: false,
  },
  disabledY: {
    type: Boolean,
    default: false,
  },
  disabledW: {
    type: Boolean,
    default: false,
  },
  disabledH: {
    type: Boolean,
    default: false,
  },
  minW: {
    type: Number,
    default: 20,
  },
  minH: {
    type: Number,
    default: 20,
  },
  active: {
    type: Boolean,
    default: false,
  },
  parent: {
    type: Boolean,
    default: false,
  },
  handles: {
    type: Array,
    default: ALL_HANDLES,
    validator: (handles: ResizingHandle[]) => {
      return filterHandles(handles).length === handles.length;
    },
  },
  classNameDraggable: {
    type: String,
    default: "draggable",
  },
  classNameResizable: {
    type: String,
    default: "resizable",
  },
  classNameDragging: {
    type: String,
    default: "dragging",
  },
  classNameResizing: {
    type: String,
    default: "resizing",
  },
  classNameActive: {
    type: String,
    default: "active",
  },
  classNameHandle: {
    type: String,
    default: "handle",
  },
  lockAspectRatio: {
    type: Boolean,
    default: false,
  },
};

const emits = [
  "activated",
  "deactivated",
  "drag-start",
  "resize-start",
  "dragging",
  "resizing",
  "drag-end",
  "resize-end",
  "update:w",
  "update:h",
  "update:x",
  "update:y",
  "update:active",
];

const VueDraggableResizable = defineComponent({
  name: "Vue3DraggableResizable",
  props: VdrProps,
  emits: emits,
  // Не забудь добавить onUnmounted и watch в импорт из 'vue' в самом верху файла! [cite: 2026-01-26]
  setup(props, { emit }) {
    const containerProps = initState(props, emit);
    const provideIdentity = inject("identity", null);
    let containerProvider: ContainerProvider | null = null;

    if (provideIdentity === IDENTITY) {
      containerProvider = {
        updatePosition: inject<UpdatePosition>("updatePosition")!,
        getPositionStore: inject<GetPositionStore>("getPositionStore")!,
        disabled: inject<Ref<boolean>>("disabled")!,
        adsorbParent: inject<Ref<boolean>>("adsorbParent")!,
        adsorbCols: inject<number[]>("adsorbCols")!,
        adsorbRows: inject<number[]>("adsorbRows")!,
        setMatchedLine: inject<SetMatchedLine>("setMatchedLine")!,
      };
    }

    const containerRef = ref<HTMLElement>();
    const parentSize = initParent(containerRef);

    // --- ВОТ ТУТ МАГИЯ НА TYPESCRIPT ---
    if (props.parent) {
      // Функция, которая будет пинать либу при каждом ресайзе [cite: 2026-02-15]
      const updateParentDimensions = () => {
        if (containerRef.value && containerRef.value.parentElement) {
          const { width, height } = getElSize(containerRef.value.parentElement);

          // Отдаем батины размеры в рефы
          if (parentSize.parentWidth) parentSize.parentWidth.value = width;
          if (parentSize.parentHeight) parentSize.parentHeight.value = height;

          // --- Уважение к ширине ---
          if (containerProps.width && containerProps.left) {
            let currentLeft = containerProps.left.value;

            // 1. Не даем элементу уехать за правый край дальше, чем его минимальная ширина
            const maxLeft = width - props.minW;

            if (currentLeft > maxLeft) {
              currentLeft = maxLeft < 0 ? 0 : maxLeft; // Если батя стал у́же минимальной ширины — прибиваем к левому краю
              containerProps.left.value = currentLeft;
              emit("update:x", currentLeft); // Отправляем Vue новые координаты
            }

            // 2. Режем ширину элемента, если он толще, чем оставшееся место
            let currentWidth = containerProps.width.value;
            const maxWidth = width - currentLeft; // Доступное место от левого края до конца бати

            if (currentWidth > maxWidth) {
              // Ужимаем, но не меньше props.minW, чтобы не превратить блок в невидимую херню
              containerProps.width.value = Math.max(maxWidth, props.minW);
              emit("update:w", containerProps.width.value); // Отправляем Vue новую ширину
            }
          }

          // --- Уважение к высоте (чтобы и по вертикали всё было чётко) ---
          if (containerProps.height && containerProps.top) {
            let currentTop = containerProps.top.value;
            const maxTop = height - props.minH;

            if (currentTop > maxTop) {
              currentTop = maxTop < 0 ? 0 : maxTop;
              containerProps.top.value = currentTop;
              emit("update:y", currentTop);
            }

            let currentHeight = containerProps.height.value;
            const maxHeight = height - currentTop;

            if (currentHeight > maxHeight) {
              containerProps.height.value = Math.max(maxHeight, props.minH);
              emit("update:h", containerProps.height.value);
            }
          }
        }
      };

      // Создаем "наблюдателя" за размерами [cite: 2026-02-15]
      const resizeObserver = new (window as any).ResizeObserver(() => {
        updateParentDimensions();
      });

      // Как только элемент появился в DOM - начинаем следить за его "батей" [cite: 2026-02-15]
      watch(containerRef, (el) => {
        if (el && el.parentElement) {
          resizeObserver.observe(el.parentElement);
          updateParentDimensions(); // Замеряем сразу при старте [cite: 2026-02-15]
        }
      });

      // Убиваем наблюдателя, когда компонент удаляется, чтобы не грузить комп [cite: 2026-01-27]
      onUnmounted(() => {
        resizeObserver.disconnect();
      });
    }
    // --- КОНЕЦ МАГИИ ---

    const limitProps = initLimitSizeAndMethods(
      props,
      parentSize,
      containerProps,
    );

    initDraggableContainer(
      containerRef,
      containerProps,
      limitProps,
      toRef(props, "draggable"),
      emit,
      containerProvider,
      parentSize,
    );

    const resizeHandle = initResizeHandle(
      containerProps,
      limitProps,
      parentSize,
      props,
      emit,
    );

    watchProps(props, limitProps);

    return {
      containerRef,
      containerProvider,
      ...containerProps,
      ...parentSize,
      ...limitProps,
      ...resizeHandle,
    };
  },
  computed: {
    style(): { [propName: string]: string } {
      return {
        width: this.width + "px",
        height: this.height + "px",
        transform: `translate3d(${this.left}px, ${this.top}px, 0)`,
      };
    },
    klass(): { [propName: string]: string | boolean } {
      return {
        [this.classNameActive]: this.enable,
        [this.classNameDragging]: this.dragging,
        [this.classNameResizing]: this.resizing,
        [this.classNameDraggable]: this.draggable,
        [this.classNameResizable]: this.resizable,
      };
    },
  },
  mounted() {
    if (!this.containerRef) return;
    this.containerRef.ondragstart = () => false;
    const { width, height } = getElSize(this.containerRef);
    this.setWidth(this.initW === null ? this.w || width : this.initW);
    this.setHeight(this.initH === null ? this.h || height : this.initH);
    if (this.containerProvider) {
      this.containerProvider.updatePosition(this.id, {
        x: this.left,
        y: this.top,
        w: this.width,
        h: this.height,
      });
    }
  },
  render() {
    return h(
      "div",
      {
        ref: "containerRef",
        class: ["vdr-container", this.klass],
        style: this.style,
      },
      [
        this.$slots.default && this.$slots.default(),
        ...this.handlesFiltered.map((item) =>
          h("div", {
            class: [
              "vdr-handle",
              "vdr-handle-" + item,
              this.classNameHandle,
              `${this.classNameHandle}-${item}`,
            ],
            style: { display: this.enable ? "block" : "none" },
            onMousedown: (e: MouseEvent) =>
              this.resizeHandleDown(e, <ResizingHandle>item),
            onTouchstart: (e: TouchEvent) =>
              this.resizeHandleDown(e, <ResizingHandle>item),
          }),
        ),
      ],
    );
  },
});

export default VueDraggableResizable;
