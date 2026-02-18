"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.ALL_HANDLES = void 0;
var vue_1 = require("vue");
var hooks_1 = require("./hooks");
require("./index.css");
var utils_1 = require("./utils");
exports.ALL_HANDLES = [
    "tl",
    "tm",
    "tr",
    "ml",
    "mr",
    "bl",
    "bm",
    "br",
];
var VdrProps = {
    initW: {
        type: Number,
        "default": null
    },
    initH: {
        type: Number,
        "default": null
    },
    w: {
        type: Number,
        "default": 0
    },
    h: {
        type: Number,
        "default": 0
    },
    x: {
        type: Number,
        "default": 0
    },
    y: {
        type: Number,
        "default": 0
    },
    draggable: {
        type: Boolean,
        "default": true
    },
    resizable: {
        type: Boolean,
        "default": true
    },
    disabledX: {
        type: Boolean,
        "default": false
    },
    disabledY: {
        type: Boolean,
        "default": false
    },
    disabledW: {
        type: Boolean,
        "default": false
    },
    disabledH: {
        type: Boolean,
        "default": false
    },
    minW: {
        type: Number,
        "default": 20
    },
    minH: {
        type: Number,
        "default": 20
    },
    active: {
        type: Boolean,
        "default": false
    },
    parent: {
        type: Boolean,
        "default": false
    },
    handles: {
        type: Array,
        "default": exports.ALL_HANDLES,
        validator: function (handles) {
            return utils_1.filterHandles(handles).length === handles.length;
        }
    },
    classNameDraggable: {
        type: String,
        "default": "draggable"
    },
    classNameResizable: {
        type: String,
        "default": "resizable"
    },
    classNameDragging: {
        type: String,
        "default": "dragging"
    },
    classNameResizing: {
        type: String,
        "default": "resizing"
    },
    classNameActive: {
        type: String,
        "default": "active"
    },
    classNameHandle: {
        type: String,
        "default": "handle"
    },
    lockAspectRatio: {
        type: Boolean,
        "default": false
    }
};
var emits = [
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
var VueDraggableResizable = vue_1.defineComponent({
    name: "Vue3DraggableResizable",
    props: VdrProps,
    emits: emits,
    // Не забудь добавить onUnmounted и watch в импорт из 'vue' в самом верху файла! [cite: 2026-01-26]
    setup: function (props, _a) {
        var emit = _a.emit;
        var containerProps = hooks_1.initState(props, emit);
        var provideIdentity = vue_1.inject("identity", null);
        var containerProvider = null;
        if (provideIdentity === utils_1.IDENTITY) {
            containerProvider = {
                updatePosition: vue_1.inject("updatePosition"),
                getPositionStore: vue_1.inject("getPositionStore"),
                disabled: vue_1.inject("disabled"),
                adsorbParent: vue_1.inject("adsorbParent"),
                adsorbCols: vue_1.inject("adsorbCols"),
                adsorbRows: vue_1.inject("adsorbRows"),
                setMatchedLine: vue_1.inject("setMatchedLine")
            };
        }
        var containerRef = vue_1.ref();
        var parentSize = hooks_1.initParent(containerRef);
        // --- ВОТ ТУТ МАГИЯ НА TYPESCRIPT ---
        if (props.parent) {
            // Функция, которая будет пинать либу при каждом ресайзе [cite: 2026-02-15]
            var updateParentDimensions_1 = function () {
                if (containerRef.value && containerRef.value.parentElement) {
                    var _a = utils_1.getElSize(containerRef.value.parentElement), width = _a.width, height = _a.height;
                    // Отдаем батины размеры в рефы
                    if (parentSize.parentWidth)
                        parentSize.parentWidth.value = width;
                    if (parentSize.parentHeight)
                        parentSize.parentHeight.value = height;
                    // --- Уважение к ширине ---
                    if (containerProps.width && containerProps.left) {
                        var currentLeft = containerProps.left.value;
                        // 1. Не даем элементу уехать за правый край дальше, чем его минимальная ширина
                        var maxLeft = width - props.minW;
                        if (currentLeft > maxLeft) {
                            currentLeft = maxLeft < 0 ? 0 : maxLeft; // Если батя стал у́же минимальной ширины — прибиваем к левому краю
                            containerProps.left.value = currentLeft;
                            emit("update:x", currentLeft); // Отправляем Vue новые координаты
                        }
                        // 2. Режем ширину элемента, если он толще, чем оставшееся место
                        var currentWidth = containerProps.width.value;
                        var maxWidth = width - currentLeft; // Доступное место от левого края до конца бати
                        if (currentWidth > maxWidth) {
                            // Ужимаем, но не меньше props.minW, чтобы не превратить блок в невидимую херню
                            containerProps.width.value = Math.max(maxWidth, props.minW);
                            emit("update:w", containerProps.width.value); // Отправляем Vue новую ширину
                        }
                    }
                    // --- Уважение к высоте (чтобы и по вертикали всё было чётко) ---
                    if (containerProps.height && containerProps.top) {
                        var currentTop = containerProps.top.value;
                        var maxTop = height - props.minH;
                        if (currentTop > maxTop) {
                            currentTop = maxTop < 0 ? 0 : maxTop;
                            containerProps.top.value = currentTop;
                            emit("update:y", currentTop);
                        }
                        var currentHeight = containerProps.height.value;
                        var maxHeight = height - currentTop;
                        if (currentHeight > maxHeight) {
                            containerProps.height.value = Math.max(maxHeight, props.minH);
                            emit("update:h", containerProps.height.value);
                        }
                    }
                }
            };
            // Создаем "наблюдателя" за размерами [cite: 2026-02-15]
            var resizeObserver_1 = new window.ResizeObserver(function () {
                updateParentDimensions_1();
            });
            // Как только элемент появился в DOM - начинаем следить за его "батей" [cite: 2026-02-15]
            vue_1.watch(containerRef, function (el) {
                if (el && el.parentElement) {
                    resizeObserver_1.observe(el.parentElement);
                    updateParentDimensions_1(); // Замеряем сразу при старте [cite: 2026-02-15]
                }
            });
            // Убиваем наблюдателя, когда компонент удаляется, чтобы не грузить комп [cite: 2026-01-27]
            vue_1.onUnmounted(function () {
                resizeObserver_1.disconnect();
            });
        }
        // --- КОНЕЦ МАГИИ ---
        var limitProps = hooks_1.initLimitSizeAndMethods(props, parentSize, containerProps);
        hooks_1.initDraggableContainer(containerRef, containerProps, limitProps, vue_1.toRef(props, "draggable"), emit, containerProvider, parentSize);
        var resizeHandle = hooks_1.initResizeHandle(containerProps, limitProps, parentSize, props, emit);
        hooks_1.watchProps(props, limitProps);
        return __assign(__assign(__assign(__assign({ containerRef: containerRef,
            containerProvider: containerProvider }, containerProps), parentSize), limitProps), resizeHandle);
    },
    computed: {
        style: function () {
            return {
                width: this.width + "px",
                height: this.height + "px",
                transform: "translate3d(" + this.left + "px, " + this.top + "px, 0)"
            };
        },
        klass: function () {
            var _a;
            return _a = {},
                _a[this.classNameActive] = this.enable,
                _a[this.classNameDragging] = this.dragging,
                _a[this.classNameResizing] = this.resizing,
                _a[this.classNameDraggable] = this.draggable,
                _a[this.classNameResizable] = this.resizable,
                _a;
        }
    },
    mounted: function () {
        if (!this.containerRef)
            return;
        this.containerRef.ondragstart = function () { return false; };
        var _a = utils_1.getElSize(this.containerRef), width = _a.width, height = _a.height;
        this.setWidth(this.initW === null ? this.w || width : this.initW);
        this.setHeight(this.initH === null ? this.h || height : this.initH);
        if (this.containerProvider) {
            this.containerProvider.updatePosition(this.id, {
                x: this.left,
                y: this.top,
                w: this.width,
                h: this.height
            });
        }
    },
    render: function () {
        var _this = this;
        return vue_1.h("div", {
            ref: "containerRef",
            "class": ["vdr-container", this.klass],
            style: this.style
        }, __spreadArrays([
            this.$slots["default"] && this.$slots["default"]()
        ], this.handlesFiltered.map(function (item) {
            return vue_1.h("div", {
                "class": [
                    "vdr-handle",
                    "vdr-handle-" + item,
                    _this.classNameHandle,
                    _this.classNameHandle + "-" + item,
                ],
                style: { display: _this.enable ? "block" : "none" },
                onMousedown: function (e) {
                    return _this.resizeHandleDown(e, item);
                },
                onTouchstart: function (e) {
                    return _this.resizeHandleDown(e, item);
                }
            });
        })));
    }
});
exports["default"] = VueDraggableResizable;
