import { useRef, useEffect } from 'react';
import { useIPC, useIPCMutation } from '../hooks/useIPC';
import { IPC_CHANNELS } from '@shared/ipc/channels';
import type { Product } from '@shared/types/ipc';
import type { CreateProductRequest } from '@shared/validation/schemas';
import './ProductsPage.css';

/**
 * Products Page
 * 
 * Product inventory management.
 * Keyboard shortcut: F3
 * 
 * EXAMPLE: Using IPC wrapper
 */



function ProductsPage() {

  const { 
    data: products, 
    loading: loadingProducts, 
    execute: fetchProducts 
  } = useIPC<Product[]>(IPC_CHANNELS.PRODUCT_LIST);

  const {
    loading: creating,
    execute: createProduct
  } = useIPCMutation<CreateProductRequest, Product>(IPC_CHANNELS.PRODUCT_CREATE);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleAddProduct = async () => {
    // Demo product data
    const newProduct = {
      name: 'New Product ' + Math.floor(Math.random() * 1000),
      price: 100,
      stock: 10,
    };

    const result = await createProduct(newProduct);
    
    if (result) {
      // Refresh list on success
      fetchProducts();
      alert('Product added successfully!');
    } else {
      alert('Failed to add product');
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1 className="page-title">Products</h1>
        <p className="page-subtitle">Manage inventory</p>
      </header>

      <div className="page-content">
        <div className="products-container">
          <div className="products-header">
            <h2>Product List ({products?.length || 0})</h2>
            <button 
              onClick={handleAddProduct} 
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? 'Adding...' : 'Add Product'}
            </button>
          </div>

          {loadingProducts && <div className="loading">Loading products...</div>}

          {!loadingProducts && (!products || products.length === 0) ? (
            <div className="placeholder-card">
              <div className="placeholder-icon">📦</div>
              <h2>No Products</h2>
              <p>Add your first product to get started</p>
            </div>
          ) : (
            <div className="products-grid">
              {products?.map((product) => (
                <div key={product.id} className="product-card">
                  <h3>{product.name}</h3>
                  <p className="product-price">₹{product.price}</p>
                  <p className="product-stock">Stock: {product.stock}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductsPage;
