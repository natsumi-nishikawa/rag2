import { useMemo, useState } from "react";
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
  id: number;
  type: ItemType;

  // 店舗内での位置（m）
  xMeters: number;
  yMeters: number;

  // 設備自体の大きさ（m）
  widthMeters: number;
  depthMeters: number;

  direction: Direction;

  tableShape?: TableShape;
};

const itemNames: Record<ItemType, string> = {
  table: "テーブル",
  register: "レジ",
  fitting: "試着室",
  entrance: "入口",
  wallRack: "壁面ラック",
  fixedRack: "固定ラック",
};

const tableShapeNames: Record<TableShape, string> = {
  square: "正方形",
  circle: "円形",
  rectangle: "長方形",
};

export default function VmdLayout() {
  // ==============================
  // 店舗
  // ==============================

  const [storeShape, setStoreShape] =
    useState<StoreShape>("rectangle");

  const [storeWidth, setStoreWidth] =
    useState(12);

  const [storeDepth, setStoreDepth] =
    useState(8);

  // ==============================
  // 固定設備
  // ==============================

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

  // ==============================
  // 可動設備・商品条件
  // ==============================

  const [rackCount, setRackCount] =
    useState(4);

  const [bodyCount, setBodyCount] =
    useState(1);

  const [productAmount, setProductAmount] =
    useState("標準");

  const [season, setSeason] =
    useState("秋");

  const [mainProduct, setMainProduct] =
    useState("");

  // ==============================
  // 選択中の配置済み設備
  // ==============================

  const [selectedItemId, setSelectedItemId] =
    useState<number | null>(null);

  // ==============================
  // 店舗面積
  // ==============================

  const storeArea = useMemo(() => {
    if (storeShape === "rectangle") {
      return storeWidth * storeDepth;
    }

    // L字型は現在、右下1/4を欠いた形として計算
    return storeWidth * storeDepth * 0.75;
  }, [storeShape, storeWidth, storeDepth]);

  // ==============================
  // 設備の種類を変更したとき
  // 標準サイズを設定
  // ==============================

  const selectFixture = (type: ItemType) => {
    setSelectedType(type);
    setSelectedItemId(null);

    if (type === "table") {
      setItemWidth(2);
      setItemDepth(1);
    }

    if (type === "register") {
      setItemWidth(2);
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
      setItemWidth(3);
      setItemDepth(0.5);
    }

    if (type === "fixedRack") {
      setItemWidth(2.5);
      setItemDepth(0.8);
    }
  };

  // ==============================
  // 店舗をクリックして設備配置
  // ==============================

  const addItem = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    if (selectedItemId !== null) {
      setSelectedItemId(null);
      return;
    }

    const rect =
      event.currentTarget.getBoundingClientRect();

    const clickX =
      event.clientX - rect.left;

    const clickY =
      event.clientY - rect.top;

    const xRatio =
      clickX / rect.width;

    const yRatio =
      clickY / rect.height;

    const xMeters =
      Number(
        (xRatio * storeWidth).toFixed(2)
      );

    const yMeters =
      Number(
        (yRatio * storeDepth).toFixed(2)
      );

    // L字型の欠けている場所には置かない
    if (
      storeShape === "l-shape" &&
      xRatio > 0.5 &&
      yRatio > 0.5
    ) {
      alert(
        "この場所はL字型店舗の外側です。"
      );
      return;
    }

    const newItem: LayoutItem = {
      id: Date.now(),
      type: selectedType,
      xMeters,
      yMeters,
      widthMeters: itemWidth,
      depthMeters: itemDepth,
      direction: 0,

      ...(selectedType === "table"
        ? { tableShape }
        : {}),
    };

    setItems((currentItems) => [
      ...currentItems,
      newItem,
    ]);
  };

  // ==============================
  // 設備選択
  // ==============================

  const selectPlacedItem = (
    event: React.MouseEvent,
    id: number
  ) => {
    event.stopPropagation();
    setSelectedItemId(id);
  };

  // ==============================
  // 設備削除
  // ==============================

  const deleteSelectedItem = () => {
    if (selectedItemId === null) {
      return;
    }

    setItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.id !== selectedItemId
      )
    );

    setSelectedItemId(null);
  };

  // ==============================
  // 90度回転
  // ==============================

  const rotateSelectedItem = () => {
    if (selectedItemId === null) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== selectedItemId) {
          return item;
        }

        return {
          ...item,

          direction:
            item.direction === 0
              ? 90
              : 0,
        };
      })
    );
  };

  // ==============================
  // 全設備削除
  // ==============================

  const clearLayout = () => {
    const ok = window.confirm(
      "配置した固定設備をすべて削除しますか？"
    );

    if (!ok) {
      return;
    }

    setItems([]);
    setSelectedItemId(null);
  };

  // ==============================
  // AIへ渡す店舗データ
  // ==============================

  const handleProposal = () => {
    const storeData = {
      store: {
        shape: storeShape,
        widthMeters: storeWidth,
        depthMeters: storeDepth,
        areaSquareMeters:
          Number(storeArea.toFixed(1)),
      },

      fixedItems: items,

      movableItems: {
        rackCount,
        bodyCount,
      },

      merchandising: {
        productAmount,
        season,
        mainProduct,
      },
    };

    console.log(
      "AIへ送る店舗情報",
      storeData
    );

    alert(
      "店舗情報を作成しました。\nConsoleで内容を確認できます。"
    );
  };

  // ==============================
  // 表示用サイズ計算
  // ==============================

  const getItemStyle = (
    item: LayoutItem
  ) => {
    const left =
      (item.xMeters / storeWidth) * 100;

    const top =
      (item.yMeters / storeDepth) * 100;

    const rotated =
      item.direction === 90;

    const displayWidth =
      rotated
        ? item.depthMeters
        : item.widthMeters;

    const displayDepth =
      rotated
        ? item.widthMeters
        : item.depthMeters;

    const width =
      (displayWidth / storeWidth) * 100;

    const height =
      (displayDepth / storeDepth) * 100;

    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${width}%`,
      height: `${height}%`,
    };
  };

  return (
    <div className="vmd-page">

      <div className="vmd-header">
        <h1>VMD提案</h1>

        <p>
          店舗の形・大きさ・固定設備を登録し、
          店舗ごとの売場条件を作成します。
        </p>
      </div>

      {/* ==========================
          店舗基本情報
      ========================== */}

      <section className="vmd-card">

        <h2>① 店舗の形・大きさ</h2>

        <div className="store-settings">

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
              min="1"
              step="0.5"
              value={storeWidth}
              onChange={(event) =>
                setStoreWidth(
                  Number(event.target.value)
                )
              }
            />
          </label>

          <label>
            奥行き（m）

            <input
              type="number"
              min="1"
              step="0.5"
              value={storeDepth}
              onChange={(event) =>
                setStoreDepth(
                  Number(event.target.value)
                )
              }
            />
          </label>

          <div className="area-display">
            <span>店舗面積</span>

            <strong>
              {storeArea.toFixed(1)}㎡
            </strong>
          </div>

        </div>

        {storeShape === "l-shape" && (
          <p className="small-note">
            ※現在のL字型は、店舗右下の
            4分の1が欠けた形として扱います。
          </p>
        )}

      </section>

      {/* ==========================
          レイアウト作成
      ========================== */}

      <div className="vmd-main-grid">

        <section className="vmd-card">

          <h2>② 固定設備を配置</h2>

          <p className="help-text">
            設備を選んでから、
            店舗図の配置したい場所を
            クリックしてください。
          </p>

          <div className="fixture-buttons">

            {(
              Object.keys(
                itemNames
              ) as ItemType[]
            ).map((type) => (
              <button
                key={type}
                className={
                  selectedType === type
                    ? "selected"
                    : ""
                }
                onClick={() =>
                  selectFixture(type)
                }
              >
                {itemNames[type]}
              </button>
            ))}

          </div>

          {/* テーブル形状 */}

          {selectedType === "table" && (
            <div className="fixture-options">

              <span className="option-title">
                テーブル形状
              </span>

              <div className="shape-buttons">

                {(
                  Object.keys(
                    tableShapeNames
                  ) as TableShape[]
                ).map((shape) => (
                  <button
                    key={shape}
                    className={
                      tableShape === shape
                        ? "selected"
                        : ""
                    }
                    onClick={() =>
                      setTableShape(shape)
                    }
                  >
                    {shape === "square" &&
                      "□ "}

                    {shape === "circle" &&
                      "○ "}

                    {shape ===
                      "rectangle" &&
                      "▭ "}

                    {
                      tableShapeNames[
                        shape
                      ]
                    }
                  </button>
                ))}

              </div>

            </div>
          )}

          {/* 設備サイズ */}

          <div className="fixture-size">

            <label>
              横幅（m）

              <input
                type="number"
                min="0.1"
                step="0.1"
                value={itemWidth}
                onChange={(event) =>
                  setItemWidth(
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>

            <label>
              奥行き（m）

              <input
                type="number"
                min="0.1"
                step="0.1"
                value={itemDepth}
                onChange={(event) =>
                  setItemDepth(
                    Number(
                      event.target.value
                    )
                  )
                }
              />
            </label>

          </div>

          {/* 店舗図 */}

          <div
            className={`store-layout ${storeShape}`}
            onClick={addItem}
          >

            {storeShape ===
              "l-shape" && (
              <div className="l-shape-cutout">
                店舗外
              </div>
            )}

            {items.map((item) => {

              const selected =
                item.id ===
                selectedItemId;

              const isCircle =
                item.type === "table" &&
                item.tableShape ===
                  "circle";

              return (
                <div
                  key={item.id}
                  className={[
                    "layout-item",
                    item.type,
                    selected
                      ? "item-selected"
                      : "",
                    isCircle
                      ? "circle-table"
                      : "",
                  ].join(" ")}
                  style={
                    getItemStyle(item)
                  }
                  onClick={(event) =>
                    selectPlacedItem(
                      event,
                      item.id
                    )
                  }
                >
                  {itemNames[item.type]}
                </div>
              );
            })}

          </div>

          <div className="layout-actions">

            <span>
              配置した設備をクリックすると
              選択できます。
            </span>

            <div>

              <button
                onClick={
                  rotateSelectedItem
                }
                disabled={
                  selectedItemId === null
                }
              >
                90°回転
              </button>

              <button
                onClick={
                  deleteSelectedItem
                }
                disabled={
                  selectedItemId === null
                }
              >
                選択設備を削除
              </button>

              <button
                className="danger-button"
                onClick={clearLayout}
              >
                全て削除
              </button>

            </div>

          </div>

        </section>

        {/* ==========================
            店舗条件
        ========================== */}

        <section className="vmd-card condition-section">

          <h2>③ 売場条件</h2>

          <label>
            可動ラック数

            <input
              type="number"
              min="0"
              value={rackCount}
              onChange={(event) =>
                setRackCount(
                  Number(
                    event.target.value
                  )
                )
              }
            />
          </label>

          <label>
            ボディ数

            <input
              type="number"
              min="0"
              value={bodyCount}
              onChange={(event) =>
                setBodyCount(
                  Number(
                    event.target.value
                  )
                )
              }
            />
          </label>

          <label>
            商品量

            <select
              value={productAmount}
              onChange={(event) =>
                setProductAmount(
                  event.target.value
                )
              }
            >
              <option value="少ない">
                少ない
              </option>

              <option value="標準">
                標準
              </option>

              <option value="多い">
                多い
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

          <label>
            重点商品

            <input
              type="text"
              value={mainProduct}
              placeholder="例：秋の新作ニット"
              onChange={(event) =>
                setMainProduct(
                  event.target.value
                )
              }
            />
          </label>

          <div className="fixture-summary">

            <h3>登録した固定設備</h3>

            {items.length === 0 ? (
              <p>
                まだ設備がありません。
              </p>
            ) : (
              <ul>
                {(
                  Object.keys(
                    itemNames
                  ) as ItemType[]
                ).map((type) => {

                  const count =
                    items.filter(
                      (item) =>
                        item.type === type
                    ).length;

                  if (count === 0) {
                    return null;
                  }

                  return (
                    <li key={type}>
                      {itemNames[type]}：
                      {count}
                    </li>
                  );
                })}
              </ul>
            )}

          </div>

          <button
            className="proposal-button"
            onClick={handleProposal}
          >
            AIにVMDを提案してもらう
          </button>

        </section>

      </div>

    </div>
  );
}