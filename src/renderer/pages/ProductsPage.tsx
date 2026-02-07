import { useState, useEffect } from 'react';
import { useIPCCall } from '../utils/ipc';
import './ProductsPage.css';

/**
 * Products Page
 * 
 * Product inventory management.
 * Keyboard shortcut: F3
 * 
 * EXAMPLE: Using IPC wrapper
 */

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const callIPC = useIPCCall();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      // IPC call with automatic loading state
      const result = await callIPC(
        () => window.electron.products.getAll(),
        {
          showLoading: true,
          showError: true,
          errorMessage: 'Failed to load products',
        }
      );
      
      setProducts(result as Product[]);
    } catch (error) {
      // Error already handled by IPC wrapper
      // Component-specific error handling here if needed
      console.error('Product fetch error:', error);
    }
  };

  const handleAddProduct = async () => {
    try {
      await callIPC(
        () => window.electron.products.create({
          name: 'New Product',
          price: 100,
          stock: 10,
        }),
        {
          showLoading: true,
          showSuccess: true,
          successMessage: 'Product added successfully!',
          showError: true,
          errorMessage: 'Failed to add product',
        }
      );
      
      // Refresh list
      fetchProducts();
    } catch (error) {
      // Error already shown to user
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
            <h2>Product List ({products.length})</h2>
            <button onClick={handleAddProduct} className="btn btn-primary">
              Add Product
            </button>
          </div>

          {products.length === 0 ? (
            <div className="placeholder-card">
              <div className="placeholder-icon">📦</div>
              <h2>No Products</h2>
              <p>Add your first product to get started</p>
            </div>
          ) : (
            <div className="products-grid">
              {products.map((product) => (
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
