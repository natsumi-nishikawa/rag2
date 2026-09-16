import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./VmdLayout.css";

type StoreShape = "rectangle" | "l-shape";

type ItemType =
  | "table"
  | "register"
  | "fitting"
  | "entrance"
  | "wallRack"
  | "fixedRack";

type TableShape =
  | "square"
  | "circle"
  | "rectangle";

type Direction = 0 | 90;

type LayoutItem = {
  id: string;
  type: ItemType;
  xMeters: number;
  yMeters: number;
  widthMeters: number;
  depthMeters: number;
  direction: Direction;
  tableShape?: TableShape;
};

type ProposalPlacement = {
  id?: string;
  type: "rack" | "body";
  xMeters: number;
  yMeters: number;
  widthMeters: number;
  depthMeters: number;
  direction: number;
  product: string;
  reason: string;
};

type EditableProposalPlacement =
  ProposalPlacement & {
    id: string;
  };

type FixedItemSuggestion = {
  fixedItemId: string;
  product: string;
  reason: string;
};

type VmdSource = {
  filename: string;
  page: number | string;
};

type VmdProposal = {
  summary: string;
  placements: ProposalPlacement[];
  fixedItemSuggestions: FixedItemSuggestion[];
  sources: VmdSource[];
};

type SavedStore = {
  id: string;
  name: string;
  storeShape: StoreShape;
  storeWidth: number;
  storeDepth: number;
  fixedItems: LayoutItem[];
};

const PIXELS_PER_METER = 50;

const itemLabels: Record<ItemType, string> = {
  table: "テーブル",
  register: "レジ",
  fitting: "試着室",
  entrance: "入口",
  wallRack: "壁面ラック",
  fixedRack: "固定ラック",
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export default function VmdLayout() {
  const [storeName, setStoreName] =
    useState("");

  const [storeShape, setStoreShape] =
    useState<StoreShape>("rectangle");

  const [storeWidth, setStoreWidth] =
    useState(12);

  const [storeDepth, setStoreDepth] =
    useState(8);

  const [items, setItems] =
    useState<LayoutItem[]>([]);

  const [selectedType, setSelectedType] =
    useState<ItemType>("table");

  const [tableShape, setTableShape] =
    useState<TableShape>("rectangle");

  const [itemWidth, setItemWidth] =
    useState(2);

  const [itemDepth, setItemDepth] =
    useState(1);

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState<string | null>(null);

  const [
    draggingItemId,
    setDraggingItemId,
  ] = useState<string | null>(null);

  const [
    draggingProposalId,
    setDraggingProposalId,
  ] = useState<string | null>(null);

  const [
    savedStores,
    setSavedStores,
  ] = useState<SavedStore[]>([]);

  const [rackCount, setRackCount] =
    useState(4);

  const [bodyCount, setBodyCount] =
    useState(1);

  const [
    productAmount,
    setProductAmount,
  ] = useState("標準");

  const [season, setSeason] =
    useState("秋");

  const [mainProduct, setMainProduct] =
    useState("");

  const [
    vmdProposal,
    setVmdProposal,
  ] = useState<VmdProposal | null>(null);

  const [
    editablePlacements,
    setEditablePlacements,
  ] = useState<
    EditableProposalPlacement[]
  >([]);

  const [
    proposalLoading,
    setProposalLoading,
  ] = useState(false);

  const [
    proposalError,
    setProposalError,
  ] = useState("");

  const [
    selectedProposalId,
    setSelectedProposalId,
  ] = useState<string | null>(null);

  const didDragRef = useRef(false);

  useEffect(() => {
    const saved =
      localStorage.getItem(
        "lumina-vmd-stores"
      );

    if (!saved) {
      return;
    }

    try {
      const parsed =
        JSON.parse(saved);

      if (Array.isArray(parsed)) {
        setSavedStores(parsed);
      }
    } catch (error) {
      console.error(
        "保存店舗の読み込みエラー",
        error
      );
    }
  }, []);

  const storeArea = useMemo(() => {
    if (storeShape === "rectangle") {
      return storeWidth * storeDepth;
    }

    return (
      storeWidth *
      storeDepth *
      0.75
    );
  }, [
    storeShape,
    storeWidth,
    storeDepth,
  ]);

  const canvasWidth =
    storeWidth *
    PIXELS_PER_METER;

  const canvasHeight =
    storeDepth *
    PIXELS_PER_METER;

  function selectFixture(
    type: ItemType
  ) {
    setSelectedType(type);

    if (type === "table") {
      setItemWidth(2);
      setItemDepth(1);
    }

    if (type === "register") {
      setItemWidth(2.4);
      setItemDepth(0.8);
    }

    if (type === "fitting") {
      setItemWidth(1.5);
      setItemDepth(1.5);
    }

    if (type === "entrance") {
      setItemWidth(2);
      setItemDepth(0.3);
    }

    if (type === "wallRack") {
      setItemWidth(2);
      setItemDepth(0.4);
    }

    if (type === "fixedRack") {
      setItemWidth(1.8);
      setItemDepth(0.6);
    }
  }

  function isPointInStore(
    xMeters: number,
    yMeters: number
  ) {
    if (
      xMeters < 0 ||
      yMeters < 0 ||
      xMeters > storeWidth ||
      yMeters > storeDepth
    ) {
      return false;
    }

    if (storeShape === "l-shape") {
      const cutX =
        storeWidth * 0.5;

      const cutY =
        storeDepth * 0.5;

      if (
        xMeters > cutX &&
        yMeters > cutY
      ) {
        return false;
      }
    }

    return true;
  }

  function isItemInsideStore(
    xMeters: number,
    yMeters: number,
    widthMeters: number,
    depthMeters: number
  ) {
    const halfWidth =
      widthMeters / 2;

    const halfDepth =
      depthMeters / 2;

    const points = [
      {
        x: xMeters - halfWidth,
        y: yMeters - halfDepth,
      },
      {
        x: xMeters + halfWidth,
        y: yMeters - halfDepth,
      },
      {
        x: xMeters - halfWidth,
        y: yMeters + halfDepth,
      },
      {
        x: xMeters + halfWidth,
        y: yMeters + halfDepth,
      },
    ];

    return points.every((point) =>
      isPointInStore(
        point.x,
        point.y
      )
    );
  }

  function getPositionMeters(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    const rect =
      event.currentTarget.getBoundingClientRect();

    const xPixels =
      event.clientX - rect.left;

    const yPixels =
      event.clientY - rect.top;

    return {
      xMeters:
        xPixels /
        PIXELS_PER_METER,
      yMeters:
        yPixels /
        PIXELS_PER_METER,
    };
  }

  function addItem(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }

    if (
      draggingItemId ||
      draggingProposalId
    ) {
      return;
    }

    const position =
      getPositionMeters(event);

    if (
      !isItemInsideStore(
        position.xMeters,
        position.yMeters,
        itemWidth,
        itemDepth
      )
    ) {
      return;
    }

    const newItem: LayoutItem = {
      id: createId("fixed"),
      type: selectedType,
      xMeters:
        position.xMeters,
      yMeters:
        position.yMeters,
      widthMeters: itemWidth,
      depthMeters: itemDepth,
      direction: 0,
      tableShape:
        selectedType === "table"
          ? tableShape
          : undefined,
    };

    setItems((current) => [
      ...current,
      newItem,
    ]);

    setSelectedItemId(
      newItem.id
    );

    setSelectedProposalId(null);
  }

  function startFixedDrag(
    event: React.MouseEvent,
    id: string
  ) {
    event.stopPropagation();

    didDragRef.current = false;

    setDraggingItemId(id);
    setDraggingProposalId(null);
    setSelectedItemId(id);
    setSelectedProposalId(null);
  }

  function startProposalDrag(
    event: React.MouseEvent,
    id: string
  ) {
    event.stopPropagation();

    didDragRef.current = false;

    setDraggingProposalId(id);
    setDraggingItemId(null);
    setSelectedProposalId(id);
    setSelectedItemId(null);
  }

  function moveItem(
    event: React.MouseEvent<HTMLDivElement>
  ) {
    if (
      !draggingItemId &&
      !draggingProposalId
    ) {
      return;
    }

    didDragRef.current = true;

    const position =
      getPositionMeters(event);

    if (draggingItemId) {
      const target =
        items.find(
          (item) =>
            item.id ===
            draggingItemId
        );

      if (!target) {
        return;
      }

      if (
        !isItemInsideStore(
          position.xMeters,
          position.yMeters,
          target.widthMeters,
          target.depthMeters
        )
      ) {
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id ===
          draggingItemId
            ? {
                ...item,
                xMeters:
                  position.xMeters,
                yMeters:
                  position.yMeters,
              }
            : item
        )
      );

      return;
    }

    if (draggingProposalId) {
      const target =
        editablePlacements.find(
          (placement) =>
            placement.id ===
            draggingProposalId
        );

      if (!target) {
        return;
      }

      if (
        !isItemInsideStore(
          position.xMeters,
          position.yMeters,
          target.widthMeters,
          target.depthMeters
        )
      ) {
        return;
      }

      setEditablePlacements(
        (current) =>
          current.map(
            (placement) =>
              placement.id ===
              draggingProposalId
                ? {
                    ...placement,
                    xMeters:
                      position.xMeters,
                    yMeters:
                      position.yMeters,
                  }
                : placement
          )
      );
    }
  }

  function stopDrag() {
    setDraggingItemId(null);
    setDraggingProposalId(null);

    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  }

  function rotateSelectedItem() {
    if (selectedItemId) {
      setItems((current) =>
        current.map((item) =>
          item.id ===
          selectedItemId
            ? {
                ...item,
                direction:
                  item.direction === 0
                    ? 90
                    : 0,
              }
            : item
        )
      );

      return;
    }

    if (selectedProposalId) {
      setEditablePlacements(
        (current) =>
          current.map(
            (placement) =>
              placement.id ===
              selectedProposalId
                ? {
                    ...placement,
                    direction:
                      placement.direction ===
                      90
                        ? 0
                        : 90,
                  }
                : placement
          )
      );
    }
  }

  function deleteSelectedItem() {
    if (selectedItemId) {
      setItems((current) =>
        current.filter(
          (item) =>
            item.id !==
            selectedItemId
        )
      );

      setSelectedItemId(null);
      return;
    }

    if (selectedProposalId) {
      setEditablePlacements(
        (current) =>
          current.filter(
            (placement) =>
              placement.id !==
              selectedProposalId
          )
      );

      setSelectedProposalId(null);
    }
  }

  function clearLayout() {
    setItems([]);
    setSelectedItemId(null);
    setEditablePlacements([]);
    setSelectedProposalId(null);
    setVmdProposal(null);
    setProposalError("");
  }

  function saveStore() {
    const name =
      storeName.trim();

    if (!name) {
      alert(
        "店舗名を入力してください"
      );
      return;
    }

    const newStore: SavedStore = {
      id: createId("store"),
      name,
      storeShape,
      storeWidth,
      storeDepth,
      fixedItems: items,
    };

    const updated = [
      ...savedStores,
      newStore,
    ];

    setSavedStores(updated);

    localStorage.setItem(
      "lumina-vmd-stores",
      JSON.stringify(updated)
    );

    alert(
      "店舗レイアウトを保存しました"
    );
  }

  function loadStore(
    store: SavedStore
  ) {
    setStoreName(store.name);
    setStoreShape(
      store.storeShape
    );
    setStoreWidth(
      store.storeWidth
    );
    setStoreDepth(
      store.storeDepth
    );
    setItems(
      store.fixedItems
    );

    setVmdProposal(null);
    setEditablePlacements([]);
    setSelectedItemId(null);
    setSelectedProposalId(null);
    setProposalError("");
  }

  function deleteStore(
    id: string
  ) {
    const updated =
      savedStores.filter(
        (store) =>
          store.id !== id
      );

    setSavedStores(updated);

    localStorage.setItem(
      "lumina-vmd-stores",
      JSON.stringify(updated)
    );
  }

  async function handleProposal() {
    if (!mainProduct.trim()) {
      setProposalError(
        "重点商品を入力してください。"
      );
      return;
    }

    if (bodyCount < 1) {
      setProposalError(
        "店頭に配置するボディが必要なため、ボディ数は1体以上にしてください。"
      );
      return;
    }

    setProposalLoading(true);
    setProposalError("");
    setVmdProposal(null);
    setEditablePlacements([]);

    const controller =
      new AbortController();

    const timeoutId =
      window.setTimeout(() => {
        controller.abort();
      }, 60000);

    try {
      const response = await fetch(
        "http://127.0.0.1:8000/vmd/propose",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          signal:
            controller.signal,
          body: JSON.stringify({
            store: {
              name: storeName,
              shape: storeShape,
              widthMeters:
                storeWidth,
              depthMeters:
                storeDepth,
            },

            fixedItems: items,

            movableItems: {
              rackCount,
              bodyCount,
            },

            merchandising: {
              productAmount,
              season,
              mainProduct:
              mainProduct.trim(),
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          errorData?.detail ||
            "VMD提案の取得に失敗しました。"
        );
      }

      const data: VmdProposal =
        await response.json();

      setVmdProposal(data);

      const editable =
        (
          data.placements || []
        ).map(
          (
            placement,
            index
          ) => ({
            ...placement,
            id:
              placement.id ||
              `ai-${Date.now()}-${index}`,
          })
        );

      setEditablePlacements(
        editable
      );
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name ===
          "AbortError"
      ) {
        setProposalError(
          "VMD提案に60秒以上かかったため処理を終了しました。バックエンドの状態を確認して、もう一度お試しください。"
        );
      } else {
        setProposalError(
          error instanceof Error
            ? error.message
            : "VMD提案中にエラーが発生しました。"
        );
      }
    } finally {
      window.clearTimeout(
        timeoutId
      );

      setProposalLoading(false);
    }
  }

  function getFixedItemStyle(
    item: LayoutItem
  ): React.CSSProperties {
    return {
      left:
        item.xMeters *
        PIXELS_PER_METER,
      top:
        item.yMeters *
        PIXELS_PER_METER,
      width:
        item.widthMeters *
        PIXELS_PER_METER,
      height:
        item.depthMeters *
        PIXELS_PER_METER,
      transform: `translate(-50%, -50%) rotate(${item.direction}deg)`,
    };
  }

  function getProposalStyle(
    item: EditableProposalPlacement
  ): React.CSSProperties {
    return {
      left:
        item.xMeters *
        PIXELS_PER_METER,
      top:
        item.yMeters *
        PIXELS_PER_METER,
      width:
        item.widthMeters *
        PIXELS_PER_METER,
      height:
        item.depthMeters *
        PIXELS_PER_METER,
      transform: `translate(-50%, -50%) rotate(${item.direction}deg)`,
    };
  }

  const getFixedItemDisplayName = (fixedItemId: string) => {
    const item = items.find((item) => item.id === fixedItemId);
  
    if (!item) {
      return "固定什器";
    }
  
    switch (item.type) {
      case "table":
        if (item.tableShape === "circle") {
          return "丸テーブル";
        }
  
        if (item.tableShape === "square") {
          return "正方形テーブル";
        }
  
        return "長方形テーブル";
  
      case "wallRack":
        return "壁面ラック";
  
      case "fixedRack":
        return "固定ラック";
  
      case "register":
        return "レジ";
  
      case "fittingRoom":
        return "試着室";
  
      case "entrance":
        return "入口";
  
      default:
        return "固定什器";
    }
  };

  return (
    <div className="vmd-page">
      <div className="vmd-header">
        <h1>
          VMDレイアウト提案
        </h1>

        <p>
          店舗の固定設備を登録し、
          商品条件に合わせてAIに
          売場案を提案してもらいます。
        </p>
      </div>

      <section className="vmd-section">
        <h2>
          ① 店舗情報
        </h2>

        <div className="vmd-form-grid">
          <label>
            店舗・レイアウト名
            <input
              value={storeName}
              onChange={(event) =>
                setStoreName(
                  event.target.value
                )
              }
              placeholder="例：京都店1階"
            />
          </label>

          <label>
            店舗形状
            <select
              value={storeShape}
              onChange={(event) =>
                setStoreShape(
                  event.target
                    .value as StoreShape
                )
              }
            >
              <option value="rectangle">
                長方形
              </option>

              <option value="l-shape">
                L字型
              </option>
            </select>
          </label>

          <label>
            横幅（m）
            <input
              type="number"
              min="4"
              step="0.5"
              value={storeWidth}
              onChange={(event) =>
                setStoreWidth(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label>
            奥行（m）
            <input
              type="number"
              min="4"
              step="0.5"
              value={storeDepth}
              onChange={(event) =>
                setStoreDepth(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>
        </div>

        <p className="store-area-text">
          店舗面積：約
          {storeArea.toFixed(1)}
          ㎡
        </p>
      </section>

      <section className="vmd-section">
        <h2>
          ② 固定設備を配置
        </h2>

        <p className="vmd-help">
          店舗図は固定縮尺です。
          1m = {PIXELS_PER_METER}px
          で表示しています。
        </p>

        <div className="fixture-buttons">
          {(
            Object.keys(
              itemLabels
            ) as ItemType[]
          ).map((type) => (
            <button
              key={type}
              type="button"
              className={
                selectedType ===
                type
                  ? "fixture-button active"
                  : "fixture-button"
              }
              onClick={() =>
                selectFixture(type)
              }
            >
              {itemLabels[type]}
            </button>
          ))}
        </div>

        {selectedType ===
          "table" && (
          <div className="table-shape-row">
            <span>
              テーブル形状：
            </span>

            <select
              value={tableShape}
              onChange={(event) =>
                setTableShape(
                  event.target
                    .value as TableShape
                )
              }
            >
              <option value="rectangle">
                長方形
              </option>

              <option value="square">
                正方形
              </option>

              <option value="circle">
                円形
              </option>
            </select>
          </div>
        )}

        <div className="size-controls">
          <label>
            幅（m）
            <input
              type="number"
              min="0.2"
              step="0.1"
              value={itemWidth}
              onChange={(event) =>
                setItemWidth(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label>
            奥行（m）
            <input
              type="number"
              min="0.2"
              step="0.1"
              value={itemDepth}
              onChange={(event) =>
                setItemDepth(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>
        </div>

        <div className="store-scroll-area">
          <div
            className={`store-layout ${
              storeShape ===
              "l-shape"
                ? "l-shape-store"
                : ""
            }`}
            style={{
              width:
                canvasWidth,
              height:
                canvasHeight,
              backgroundSize: `${PIXELS_PER_METER}px ${PIXELS_PER_METER}px`,
            }}
            onClick={addItem}
            onMouseMove={moveItem}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            {storeShape ===
              "l-shape" && (
              <div
                className="l-shape-cutout"
                style={{
                  left:
                    canvasWidth /
                    2,
                  top:
                    canvasHeight /
                    2,
                  width:
                    canvasWidth /
                    2,
                  height:
                    canvasHeight /
                    2,
                }}
              />
            )}

            {items.map(
              (item) => {
                const selected =
                  selectedItemId ===
                  item.id;

                const shapeClass =
                  item.type ===
                    "table" &&
                  item.tableShape
                    ? `table-${item.tableShape}`
                    : "";

                return (
                  <div
                    key={item.id}
                    className={`layout-item fixed-layout-item ${item.type} ${shapeClass} ${
                      selected
                        ? "selected"
                        : ""
                    }`}
                    style={getFixedItemStyle(
                      item
                    )}
                    onMouseDown={(
                      event
                    ) =>
                      startFixedDrag(
                        event,
                        item.id
                      )
                    }
                    onClick={(
                      event
                    ) => {
                      event.stopPropagation();
                      setSelectedItemId(
                        item.id
                      );
                      setSelectedProposalId(
                        null
                      );
                    }}
                  >
                    <span>
                      {
                        itemLabels[
                          item.type
                        ]
                      }
                    </span>
                  </div>
                );
              }
            )}

            {editablePlacements.map(
              (placement) => {
                const selected =
                  selectedProposalId ===
                  placement.id;

                return (
                  <div
                    key={
                      placement.id
                    }
                    className={`ai-placement ${
                      placement.type ===
                      "rack"
                        ? "ai-rack"
                        : "ai-body"
                    } ${
                      selected
                        ? "selected-ai"
                        : ""
                    }`}
                    style={getProposalStyle(
                      placement
                    )}
                    onMouseDown={(
                      event
                    ) =>
                      startProposalDrag(
                        event,
                        placement.id
                      )
                    }
                    onClick={(
                      event
                    ) => {
                      event.stopPropagation();

                      setSelectedProposalId(
                        placement.id
                      );

                      setSelectedItemId(
                        null
                      );
                    }}
                    title={`${placement.product}\n${placement.reason}`}
                  >
                    <span className="ai-item-name">
                      {placement.type ===
                      "rack"
                        ? "AIラック"
                        : "AIボディ"}
                    </span>

                    <span className="ai-product-name">
                      {
                        placement.product
                      }
                    </span>
                  </div>
                );
              }
            )}
          </div>
        </div>

        <div className="layout-actions">
          <button
            type="button"
            onClick={
              rotateSelectedItem
            }
            disabled={
              !selectedItemId &&
              !selectedProposalId
            }
          >
            選択した什器を90°回転
          </button>

          <button
            type="button"
            onClick={
              deleteSelectedItem
            }
            disabled={
              !selectedItemId &&
              !selectedProposalId
            }
          >
            選択した什器を削除
          </button>

          <button
            type="button"
            onClick={clearLayout}
          >
            レイアウトをクリア
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={saveStore}
          >
            店舗を保存
          </button>
        </div>
      </section>

      <section className="vmd-section">
        <h2>
          ③ 今回のVMD条件
        </h2>

        <p className="vmd-help">
          ここで入力する条件は店舗保存には含めません。
          VMD提案のたびに変更できます。
        </p>

        <div className="vmd-form-grid">
          <label>
            可動ラック数
            <input
              type="number"
              min="0"
              max="20"
              value={rackCount}
              onChange={(event) =>
                setRackCount(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label>
            ボディ数
            <input
              type="number"
              min="1"
              max="10"
              value={bodyCount}
              onChange={(event) =>
                setBodyCount(
                  Number(
                    event.target
                      .value
                  )
                )
              }
            />
          </label>

          <label>
            商品量
            <select
              value={
                productAmount
              }
              onChange={(event) =>
                setProductAmount(
                  event.target.value
                )
              }
            >
              <option value="少なめ">
                少なめ
              </option>

              <option value="標準">
                標準
              </option>

              <option value="多め">
                多め
              </option>
            </select>
          </label>

          <label>
            季節
            <select
              value={season}
              onChange={(event) =>
                setSeason(
                  event.target.value
                )
              }
            >
              <option value="春">
                春
              </option>
              <option value="夏">
                夏
              </option>
              <option value="秋">
                秋
              </option>
              <option value="冬">
                冬
              </option>
            </select>
          </label>

          <label className="full-width-field">
            重点商品
            <input
              value={mainProduct}
              onChange={(event) =>
                setMainProduct(
                  event.target.value
                )
              }
              placeholder="例：新作ニット"
            />
          </label>
        </div>

        <button
          type="button"
          className="proposal-button"
          onClick={
            handleProposal
          }
          disabled={
            proposalLoading
          }
        >
          {proposalLoading
            ? "VMDを考えています..."
            : "AIにVMDを提案してもらう"}
        </button>

        {proposalLoading && (
          <div className="vmd-loading-info">
            <div className="loading-spinner" />

            <div>
              <strong>
                売場案を作成しています
              </strong>

              <p>
                社内VMD資料と店舗条件を確認しています。
              </p>
            </div>
          </div>
        )}

        {proposalError && (
          <div className="vmd-error">
            {proposalError}
          </div>
        )}
      </section>

      {vmdProposal && (
        <section className="vmd-section proposal-result">
          <h2>
            ④ AI VMD提案
          </h2>

          <div className="proposal-summary">
            <h3>
              提案の考え方
            </h3>

            <p>
              {
                vmdProposal.summary
              }
            </p>
          </div>

          <p className="proposal-edit-help">
            青色のラックとオレンジ色のボディは、
            店舗図の上でドラッグして位置を修正できます。
          </p>

          <h3>
            可動什器の提案
          </h3>

          <div className="proposal-list">
            {editablePlacements.map(
              (
                placement,
                index
              ) => (
                <div
                  className="proposal-item"
                  key={
                    placement.id
                  }
                >
                  <strong>
                    {index + 1}.{" "}
                    {placement.type ===
                    "rack"
                      ? "ラック"
                      : "ボディ"}
                  </strong>

                  <p>
                    商品：
                    {
                      placement.product
                    }
                  </p>

                  <p>
                    理由：
                    {
                      placement.reason
                    }
                  </p>

                  <span>
                    位置：
                    {placement.xMeters.toFixed(
                      1
                    )}
                    m /
                    {placement.yMeters.toFixed(
                      1
                    )}
                    m
                  </span>
                </div>
              )
            )}
          </div>

          {vmdProposal
            .fixedItemSuggestions
            ?.length > 0 && (
            <>
              <h3 className="fixed-suggestion-title">
                固定什器の商品提案
              </h3>

              <div className="proposal-list">
                {vmdProposal.fixedItemSuggestions.map(
                  (
                    suggestion,
                    index
                  ) => (
                    <div
                      className="proposal-item fixed-proposal"
                      key={`${suggestion.fixedItemId}-${index}`}
                    >
                      <strong>
                        {getFixedItemDisplayName(suggestion.fixedItemId)}
                      </strong>

                      <p>
                        商品：
                        {
                          suggestion.product
                        }
                      </p>

                      <p>
                        理由：
                        {
                          suggestion.reason
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {vmdProposal.sources
            ?.length > 0 && (
            <>
              <h3 className="proposal-source-title">
                参考にした社内資料
              </h3>

              <div className="proposal-sources">
                {vmdProposal.sources.map(
                  (
                    source,
                    index
                  ) => (
                    <a
                      key={`${source.filename}-${source.page}-${index}`}
                      href={`http://127.0.0.1:8000/documents/${encodeURIComponent(
                        source.filename
                      )}/view`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {
                        source.filename
                      }
                      {" / "}
                      ページ
                      {source.page}
                    </a>
                  )
                )}
              </div>
            </>
          )}
        </section>
      )}

      <section className="vmd-section">
        <h2>
          保存済み店舗
        </h2>

        {savedStores.length ===
        0 ? (
          <p className="vmd-help">
            保存済みの店舗はありません。
          </p>
        ) : (
          <div className="saved-store-list">
            {savedStores.map(
              (store) => (
                <div
                  className="saved-store-item"
                  key={store.id}
                >
                  <div>
                    <strong>
                      {store.name}
                    </strong>

                    <span>
                      {store.storeWidth}
                      m ×
                      {store.storeDepth}
                      m
                    </span>
                  </div>

                  <div className="saved-store-actions">
                    <button
                      type="button"
                      onClick={() =>
                        loadStore(
                          store
                        )
                      }
                    >
                      読み込む
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        deleteStore(
                          store.id
                        )
                      }
                    >
                      削除
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  );
}