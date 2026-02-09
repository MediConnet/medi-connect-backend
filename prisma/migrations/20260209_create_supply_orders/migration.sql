-- Create supply_orders table
CREATE TABLE supply_orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  provider_id UUID NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  client_email VARCHAR(255) NOT NULL,
  client_phone VARCHAR(50) NOT NULL,
  client_address TEXT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  order_date TIMESTAMP NOT NULL,
  delivery_date TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers(id)
);

CREATE INDEX idx_supply_orders_provider ON supply_orders(provider_id);
CREATE INDEX idx_supply_orders_status ON supply_orders(status);
CREATE INDEX idx_supply_orders_date ON supply_orders(order_date);

-- Create supply_order_items table
CREATE TABLE supply_order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  product_id UUID,
  product_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES supply_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES provider_catalog(id)
);

CREATE INDEX idx_supply_order_items_order ON supply_order_items(order_id);
