"use client";

import { X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type CartItem = {
  name: string;
  price: number;
  quantity: number;
};

interface ProductCartProps {
  items: CartItem[];
  onItemsChange: (items: CartItem[]) => void;
}

export default function ProductCart({
  items,
  onItemsChange,
}: ProductCartProps) {
  const updateItem = (
    index: number,
    field: keyof CartItem,
    value: string | number
  ) => {
    const updatedItems = [...items];
    if (field === "price" || field === "quantity") {
      updatedItems[index][field] = Number(value);
    } else {
      updatedItems[index][field] = value as string;
    }
    onItemsChange(updatedItems);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    onItemsChange(updatedItems);
  };

  const addItem = () => {
    const newItems = [...items, { name: "New product", price: 0, quantity: 1 }];
    onItemsChange(newItems);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Shopping Cart
            <Badge variant="secondary" className="ml-2">
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </Badge>
          </CardTitle>
          <div className="text-lg font-semibold text-green-600">
            ${totalValue.toFixed(2)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Cart is empty</p>
            <p className="text-sm">Add products to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-12 items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="col-span-4 space-y-2">
                  <Input
                    placeholder="Product name"
                    value={item.name}
                    onChange={(e) => updateItem(index, "name", e.target.value)}
                    className="font-medium"
                  />
                  <div className="text-xs text-gray-500 px-1">Product</div>
                </div>

                <div className="col-span-3 space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">
                      $
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={item.price || ""}
                      onChange={(e) =>
                        updateItem(index, "price", e.target.value)
                      }
                      className="pl-7"
                    />
                  </div>
                  <div className="text-xs text-gray-500 px-1">Unit price</div>
                </div>

                <div className="col-span-2 space-y-2">
                  <Input
                    type="number"
                    min="1"
                    placeholder="1"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateItem(index, "quantity", e.target.value)
                    }
                  />
                  <div className="text-xs text-gray-500 px-1">Quantity</div>
                </div>

                <div className="col-span-2 space-y-2">
                  <div className="h-10 flex items-center justify-end">
                    <div className="font-semibold text-lg text-green-600">
                      ${(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 text-right px-1">
                    Subtotal
                  </div>
                </div>

                <div className="col-span-1 flex justify-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600 text-gray-400"
                    disabled={items.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={addItem}
            className="w-full flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600"
          >
            <Plus className="h-4 w-4" />
            Add product to cart
          </Button>
        </div>

        {items.length > 0 && (
          <div className="pt-4 border-t bg-gray-50 rounded-lg p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total products:</span>
                <span className="font-medium">
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </span>
              </div>
              <div className="flex justify-between text-lg font-semibold text-green-600">
                <span>Total amount:</span>
                <span>${totalValue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
