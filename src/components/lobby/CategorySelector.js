// src/components/lobby/CategorySelector.js
import React from 'react';
import { CATEGORIES } from '../../utils/constants';

const CategorySelector = ({ selectedCategory, onCategoryChange, disabled = false }) => {
  return (
    <div className="category-selector">
      <label htmlFor="category-select">Game Category:</label>
      <select
        id="category-select"
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        disabled={disabled}
        className="category-dropdown"
      >
        {CATEGORIES.map(category => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default CategorySelector;