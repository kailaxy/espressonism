"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
// @ts-ignore - Supabase client is intentionally authored in a JavaScript module.
import { supabase } from "../../supabaseClient";

type IngredientRow = {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number | string;
};

type MenuItemRow = {
  id: string;
  name: string;
};

type RecipeIngredientRow = {
  id: string;
  ingredient_id: string;
  quantity: number | string;
};

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2
});

function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed)) return 0;
  return parsed;
}

function formatCurrency(value: number): string {
  return pesoFormatter.format(Number.isFinite(value) ? value : 0);
}

export default function InventoryManager() {
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItemRow[]>([]);
  const [recipeRows, setRecipeRows] = useState<RecipeIngredientRow[]>([]);

  // selectedMenuItemId controls which accordion is expanded
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");

  const [ingredientsLoading, setIngredientsLoading] = useState(true);
  const [menuItemsLoading, setMenuItemsLoading] = useState(true);
  const [recipeLoading, setRecipeLoading] = useState(false);

  const [ingredientsError, setIngredientsError] = useState<string | null>(null);
  const [menuItemsError, setMenuItemsError] = useState<string | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  const [ingredientName, setIngredientName] = useState("");
  const [ingredientUnit, setIngredientUnit] = useState("");
  const [ingredientCost, setIngredientCost] = useState("");
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [isIngredientModalOpen, setIsIngredientModalOpen] = useState(false);

  const [selectedIngredientId, setSelectedIngredientId] = useState("");
  const [recipeQuantity, setRecipeQuantity] = useState("");
  const [isAddingRecipeRow, setIsAddingRecipeRow] = useState(false);
  const [recipeEditorMenuItemId, setRecipeEditorMenuItemId] = useState<string | null>(null);

  async function fetchIngredients() {
    setIngredientsLoading(true);
    setIngredientsError(null);

    const { data, error } = await supabase
      .from("ingredients")
      .select("id, name, unit, cost_per_unit")
      .order("name", { ascending: true });

    if (error) {
      setIngredientsError(error.message || "Failed to load ingredients.");
      setIngredients([]);
      setIngredientsLoading(false);
      return;
    }

    setIngredients((data as IngredientRow[]) ?? []);
    setIngredientsLoading(false);
  }

  async function fetchMenuItems() {
    setMenuItemsLoading(true);
    setMenuItemsError(null);

    const { data, error } = await supabase
      .from("menu_items")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      setMenuItemsError(error.message || "Failed to load menu items.");
      setMenuItems([]);
      setMenuItemsLoading(false);
      return;
    }

    const nextMenuItems = (data as MenuItemRow[]) ?? [];
    setMenuItems(nextMenuItems);

    setSelectedMenuItemId((previousId) => {
      if (previousId && nextMenuItems.some((item) => item.id === previousId)) {
        return previousId;
      }
      return nextMenuItems[0]?.id ?? "";
    });

    setMenuItemsLoading(false);
  }

  async function fetchRecipeRows(menuItemId: string) {
    if (!menuItemId) {
      setRecipeRows([]);
      setRecipeError(null);
      setRecipeLoading(false);
      return;
    }

    setRecipeLoading(true);
    setRecipeError(null);

    const { data, error } = await supabase
      .from("recipe_ingredients")
      .select("id, ingredient_id, quantity")
      .eq("menu_item_id", menuItemId)
      .order("created_at", { ascending: true });

    if (error) {
      setRecipeError(error.message || "Failed to load recipe ingredients.");
      setRecipeRows([]);
      setRecipeLoading(false);
      return;
    }

    setRecipeRows((data as RecipeIngredientRow[]) ?? []);
    setRecipeLoading(false);
  }

  useEffect(() => {
    void fetchIngredients();
    void fetchMenuItems();
  }, []);

  useEffect(() => {
    void fetchRecipeRows(selectedMenuItemId);
    setRecipeEditorMenuItemId(null);
  }, [selectedMenuItemId]);

  useEffect(() => {
    if (!isIngredientModalOpen && !recipeEditorMenuItemId) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsIngredientModalOpen(false);
      setRecipeEditorMenuItemId(null);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isIngredientModalOpen, recipeEditorMenuItemId]);

  const ingredientById = useMemo(() => {
    const lookup = new Map<string, IngredientRow>();
    for (const ingredient of ingredients) {
      lookup.set(ingredient.id, ingredient);
    }
    return lookup;
  }, [ingredients]);

  const linkedIngredientIds = useMemo(() => new Set(recipeRows.map((row) => row.ingredient_id)), [recipeRows]);

  const availableIngredients = useMemo(
    () => ingredients.filter((ingredient) => !linkedIngredientIds.has(ingredient.id)),
    [ingredients, linkedIngredientIds]
  );

  useEffect(() => {
    setSelectedIngredientId((previousId) => {
      if (previousId && availableIngredients.some((ingredient) => ingredient.id === previousId)) {
        return previousId;
      }
      return availableIngredients[0]?.id ?? "";
    });
  }, [availableIngredients]);

  const totalRecipeCost = useMemo(() => {
    return recipeRows.reduce((sum, row) => {
      const ingredient = ingredientById.get(row.ingredient_id);
      if (!ingredient) return sum;
      const quantity = toNumber(row.quantity);
      const unitCost = toNumber(ingredient.cost_per_unit);
      return sum + quantity * unitCost;
    }, 0);
  }, [ingredientById, recipeRows]);

  async function handleAddIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = ingredientName.trim();
    const unit = ingredientUnit.trim();
    const cost = Number(ingredientCost);

    if (!name || !unit) {
      setIngredientsError("Ingredient name and unit are required.");
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      setIngredientsError("Cost per unit must be a valid number greater than or equal to 0.");
      return;
    }

    setIsAddingIngredient(true);
    setIngredientsError(null);

    const { error } = await supabase.from("ingredients").insert([
      {
        name,
        unit,
        cost_per_unit: cost
      }
    ]);

    if (error) {
      setIngredientsError(error.message || "Failed to add ingredient.");
      setIsAddingIngredient(false);
      return;
    }

    setIngredientName("");
    setIngredientUnit("");
    setIngredientCost("");
    setIsAddingIngredient(false);
    setIsIngredientModalOpen(false);
    await fetchIngredients();
  }

  async function handleAddRecipeIngredient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMenuItemId) {
      setRecipeError("Select a menu item first.");
      return;
    }

    if (!selectedIngredientId) {
      setRecipeError("Choose an ingredient to add.");
      return;
    }

    const quantity = Number(recipeQuantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setRecipeError("Quantity must be greater than 0.");
      return;
    }

    setIsAddingRecipeRow(true);
    setRecipeError(null);

    const { error } = await supabase.from("recipe_ingredients").insert([
      {
        menu_item_id: selectedMenuItemId,
        ingredient_id: selectedIngredientId,
        quantity
      }
    ]);

    if (error) {
      setRecipeError(error.message || "Failed to add ingredient to recipe.");
      setIsAddingRecipeRow(false);
      return;
    }

    setRecipeQuantity("");
    setIsAddingRecipeRow(false);
    await fetchRecipeRows(selectedMenuItemId);
  }

  return (
    <div className="barista-manager-form-stretch inventory-main-grid">
      {/* LEFT PANEL: Ingredients */}
      <article className="inventory-panel">
        <header className="barista-manager-head inventory-panel-head-row">
          <h3 className="inventory-panel-title">Ingredients</h3>
          <button
            type="button"
            className="barista-manager-toggle"
            onClick={() => {
              setIngredientsError(null);
              setIsIngredientModalOpen(true);
            }}
          >
            + Add Ingredient
          </button>
        </header>

          {ingredientsError && <p className="barista-state barista-state-error">{ingredientsError}</p>}
          {ingredientsLoading && <p className="barista-state">Loading ingredients...</p>}

          {!ingredientsLoading && !ingredientsError && ingredients.length === 0 && (
            <p className="barista-empty">No ingredients yet. Add your first ingredient to begin.</p>
          )}

          {!ingredientsLoading && ingredients.length > 0 && (
            <div className="barista-menu-table-wrap">
              <table className="barista-menu-table" aria-label="Ingredient list">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Unit</th>
                    <th>Cost / Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {ingredients.map((ingredient) => (
                    <tr key={ingredient.id}>
                      <td>{ingredient.name}</td>
                      <td>{ingredient.unit}</td>
                      <td className="inventory-accent-value">{formatCurrency(toNumber(ingredient.cost_per_unit))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {/* RIGHT PANEL: Recipes & Menu Items Accordion */}
        <article className="inventory-panel">
          <header className="barista-manager-head inventory-panel-head-row">
            <h3 className="inventory-panel-title">Menu Items Recipes</h3>
          </header>
          
          {menuItemsError && <p className="barista-state barista-state-error">{menuItemsError}</p>}
          {menuItemsLoading && <p className="barista-state">Loading menu items...</p>}

          {!menuItemsLoading && !menuItemsError && menuItems.length === 0 && (
            <p className="barista-empty">No menu items found. Add menu items first to build recipes.</p>
          )}

          {!menuItemsLoading && menuItems.length > 0 && (
            <div className="inventory-accordion-list">
              {menuItems.map((item) => {
                const isExpanded = selectedMenuItemId === item.id;
                
                return (
                  <div key={item.id} className="inventory-accordion-card">
                    <button 
                      type="button"
                      className={`inventory-accordion-trigger ${isExpanded ? "inventory-accordion-trigger-expanded" : ""}`}
                      aria-expanded={isExpanded}
                      onClick={() => setSelectedMenuItemId(isExpanded ? "" : item.id)}
                    >
                      <span>{item.name}</span>
                      <span>{isExpanded ? '−' : '+'}</span>
                    </button>

                    {isExpanded && (
                      <div className="inventory-accordion-content">
                        {recipeError && <p className="barista-state barista-state-error">{recipeError}</p>}
                        {recipeLoading && <p className="barista-state">Loading recipe ingredients...</p>}
                        
                        {!recipeLoading && recipeRows.length === 0 && (
                          <p className="barista-empty">No recipe ingredients linked yet for this menu item.</p>
                        )}
                        
                        {!recipeLoading && recipeRows.length > 0 && (
                          <div className="barista-menu-table-wrap">
                            <table className="barista-menu-table">
                              <thead>
                                <tr>
                                  <th>Ingredient</th>
                                  <th>Qty</th>
                                  <th>Cost</th>
                                </tr>
                              </thead>
                              <tbody>
                                {recipeRows.map((row) => {
                                  const ingredient = ingredientById.get(row.ingredient_id);
                                  const quantity = toNumber(row.quantity);
                                  const unitCost = toNumber(ingredient?.cost_per_unit);
                                  const rowCost = quantity * unitCost;

                                  return (
                                    <tr key={row.id}>
                                      <td>{ingredient?.name ?? "Unknown"}</td>
                                      <td>{quantity} {ingredient?.unit ?? ""}</td>
                                      <td className="inventory-accent-value">{formatCurrency(rowCost)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                        
                        {!recipeLoading && (
                          <div className="inventory-recipe-total">
                            <span>Total Cost to Make</span>
                            <span>{formatCurrency(totalRecipeCost)}</span>
                          </div>
                        )}
                        
                        <button
                          type="button"
                          className="barista-menu-image-btn inventory-modify-btn"
                          onClick={() => {
                            setRecipeError(null);
                            setRecipeEditorMenuItemId(item.id);
                          }}
                        >
                          Modify Ingredients
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </article>

        {isIngredientModalOpen ? (
          <div
            className="barista-image-modal-backdrop"
            role="presentation"
            onClick={() => setIsIngredientModalOpen(false)}
          >
            <section
              className="barista-image-modal barista-manager-modal inventory-manager-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventoryIngredientModalTitle"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="barista-image-modal-head">
                <div>
                  <p className="barista-dashboard-kicker">Inventory</p>
                  <h3 id="inventoryIngredientModalTitle">Add Ingredient</h3>
                </div>
                <button
                  type="button"
                  className="barista-image-modal-close"
                  onClick={() => setIsIngredientModalOpen(false)}
                  aria-label="Close add ingredient modal"
                >
                  X
                </button>
              </header>

              <form className="barista-manager-form inventory-manager-modal-form" onSubmit={handleAddIngredient}>
                <label className="barista-form-field" htmlFor="inventoryIngredientNameModal">
                  Ingredient Name
                  <input
                    id="inventoryIngredientNameModal"
                    type="text"
                    value={ingredientName}
                    onChange={(event) => setIngredientName(event.target.value)}
                    placeholder="Arabica Beans"
                  />
                </label>

                <label className="barista-form-field" htmlFor="inventoryIngredientUnitModal">
                  Unit
                  <input
                    id="inventoryIngredientUnitModal"
                    type="text"
                    value={ingredientUnit}
                    onChange={(event) => setIngredientUnit(event.target.value)}
                    placeholder="grams, ml, pcs"
                  />
                </label>

                <label className="barista-form-field" htmlFor="inventoryIngredientCostModal">
                  Cost per Unit (PHP)
                  <input
                    id="inventoryIngredientCostModal"
                    type="number"
                    min="0"
                    step="0.01"
                    value={ingredientCost}
                    onChange={(event) => setIngredientCost(event.target.value)}
                    placeholder="0.00"
                  />
                </label>

                <div className="barista-image-modal-actions inventory-manager-modal-actions">
                  <button type="button" className="barista-menu-remove-image" onClick={() => setIsIngredientModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="barista-menu-image-btn" disabled={isAddingIngredient}>
                    {isAddingIngredient ? "Adding..." : "Add Ingredient"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {recipeEditorMenuItemId ? (
          <div
            className="barista-image-modal-backdrop"
            role="presentation"
            onClick={() => setRecipeEditorMenuItemId(null)}
          >
            <section
              className="barista-image-modal barista-manager-modal inventory-manager-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="inventoryRecipeModalTitle"
              aria-describedby="inventoryRecipeModalDescription"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="barista-image-modal-head">
                <div>
                  <p className="barista-dashboard-kicker">Recipe Editor</p>
                  <h3 id="inventoryRecipeModalTitle">Modify Ingredients</h3>
                </div>
                <button
                  type="button"
                  className="barista-image-modal-close"
                  onClick={() => setRecipeEditorMenuItemId(null)}
                  aria-label="Close recipe modal"
                >
                  X
                </button>
              </header>

              <p id="inventoryRecipeModalDescription" className="inventory-manager-modal-copy">
                Add another ingredient to the selected recipe. Existing linked ingredients stay unchanged.
              </p>

              {recipeError ? <p className="barista-state barista-state-error inventory-manager-modal-copy">{recipeError}</p> : null}

              <form className="barista-manager-form inventory-manager-modal-form" onSubmit={handleAddRecipeIngredient}>
                <label className="barista-form-field" htmlFor="inventoryRecipeIngredientSelect">
                  Add Ingredient
                  <select
                    id="inventoryRecipeIngredientSelect"
                    value={selectedIngredientId}
                    onChange={(event) => setSelectedIngredientId(event.target.value)}
                    disabled={availableIngredients.length === 0}
                  >
                    {availableIngredients.length > 0 ? (
                      availableIngredients.map((ingredient) => (
                        <option key={ingredient.id} value={ingredient.id}>
                          {ingredient.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No available ingredients left</option>
                    )}
                  </select>
                </label>

                <label className="barista-form-field" htmlFor="inventoryRecipeIngredientQty">
                  Quantity
                  <input
                    id="inventoryRecipeIngredientQty"
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={recipeQuantity}
                    onChange={(event) => setRecipeQuantity(event.target.value)}
                    placeholder="e.g. 18"
                    disabled={availableIngredients.length === 0}
                  />
                </label>

                <div className="barista-image-modal-actions inventory-manager-modal-actions">
                  <button type="button" className="barista-menu-remove-image" onClick={() => setRecipeEditorMenuItemId(null)}>
                    Done
                  </button>
                  <button
                    type="submit"
                    className="barista-menu-image-btn"
                    disabled={availableIngredients.length === 0 || isAddingRecipeRow}
                  >
                    {isAddingRecipeRow ? "Adding..." : "Save to Recipe"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
    </div>
  );
}
