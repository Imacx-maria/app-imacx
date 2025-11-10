// Validation utilities for stocks management
// Extracted from monolithic component to reduce complexity

export interface ValidationError {
  field: string
  message: string
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
}

export const FIELD_LIMITS = {
  SUPPLIER_NUMBER: 6, // Fixed: supplier_number max 6 chars
  PALETTE_NUMBER: 50,
  GUIDE_NUMBER: 20,
  REFERENCE_CODE: 30,
  QUANTITY: 6,
  QUANTITY_PALETTE: 6,
  PRICE: 10,
  TOTAL_VALUE: 12,
  SIZE: 5
} as const

export const createValidationError = (field: string, message: string): ValidationError => ({
  field,
  message
})

export const validatePaletteNumber = (paletteNumber: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!paletteNumber?.trim()) {
    return { isValid: true, errors: [] } // Optional field
  }
  
  if (paletteNumber.length > FIELD_LIMITS.PALETTE_NUMBER) {
    errors.push(createValidationError(
      'no_palete', 
      `Palete number cannot exceed ${FIELD_LIMITS.PALETTE_NUMBER} characters`
    ))
  }
  
  // Check for valid format (P followed by numbers, or comma-separated list)
  const commaSeparated = paletteNumber.split(',').map(p => p.trim())
  const invalidPalettes = commaSeparated.filter(p => !p.match(/^P\d+$/i))
  
  if (invalidPalettes.length > 0) {
    errors.push(createValidationError(
      'no_palete', 
      'Invalid palette format. Use P100 or P100,P101,P102'
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateQuantity = (quantity: string | number): ValidationResult => {
  const errors: ValidationError[] = []
  const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity
  
  if (!quantity || qty <= 0) {
    errors.push(createValidationError('quantidade', 'Quantity must be greater than 0'))
  }
  
  if (typeof quantity === 'string' && quantity.length > FIELD_LIMITS.QUANTITY) {
    errors.push(createValidationError(
      'quantidade', 
      `Quantity cannot exceed ${FIELD_LIMITS.QUANTITY} digits`
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateSupplierNumber = (supplierNumber: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (supplierNumber.length > FIELD_LIMITS.SUPPLIER_NUMBER) {
    errors.push(createValidationError(
      'fornecedor_id', 
      `Supplier number cannot exceed ${FIELD_LIMITS.SUPPLIER_NUMBER} characters`
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateGuideNumber = (guideNumber: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (guideNumber.length > FIELD_LIMITS.GUIDE_NUMBER) {
    errors.push(createValidationError(
      'no_guia_forn', 
      `Guide number cannot exceed ${FIELD_LIMITS.GUIDE_NUMBER} characters`
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateReferenceCode = (referenceCode: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (referenceCode.length > FIELD_LIMITS.REFERENCE_CODE) {
    errors.push(createValidationError(
      'ref_cartao', 
      `Reference code cannot exceed ${FIELD_LIMITS.REFERENCE_CODE} characters`
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validatePrice = (price: string | number): ValidationResult => {
  const errors: ValidationError[] = []
  const priceValue = typeof price === 'string' ? parseFloat(price) : price
  
  if (isNaN(priceValue) || priceValue < 0) {
    errors.push(createValidationError('preco_unitario', 'Price must be a valid positive number'))
  }
  
  if (typeof price === 'string' && price.length > FIELD_LIMITS.PRICE) {
    errors.push(createValidationError(
      'preco_unitario', 
      `Price cannot exceed ${FIELD_LIMITS.PRICE} digits`
    ))
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateStockEntry = (entry: any): ValidationResult => {
  const errors: ValidationError[] = []
  
  if (!entry.material_id) {
    errors.push(createValidationError('material_id', 'Material is required'))
  }
  
  const quantityValidation = validateQuantity(entry.quantidade)
  errors.push(...quantityValidation.errors)
  
  const paletteValidation = validatePaletteNumber(entry.no_palete)
  errors.push(...paletteValidation.errors)
  
  if (entry.preco_unitario) {
    const priceValidation = validatePrice(entry.preco_unitario)
    errors.push(...priceValidation.errors)
  }
  
  if (entry.no_guia_forn) {
    const guideValidation = validateGuideNumber(entry.no_guia_forn)
    errors.push(...guideValidation.errors)
  }
  
  if (entry.ref_cartao) {
    const referenceValidation = validateReferenceCode(entry.ref_cartao)
    errors.push(...referenceValidation.errors)
  }
  
  return { isValid: errors.length === 0, errors }
}

export const validateFormData = (formData: any): ValidationResult => {
  const errors: ValidationError[] = []
  
  // Material validation
  if (!formData.material_id) {
    errors.push(createValidationError('material_id', 'Please select a material'))
  }
  
  // Quantity validation
  if (!formData.quantidade) {
    errors.push(createValidationError('quantidade', 'Please enter a quantity'))
  } else {
    const quantityValidation = validateQuantity(formData.quantidade)
    errors.push(...quantityValidation.errors)
  }
  
  // Price validation (if provided)
  if (formData.preco_unitario) {
    const priceValidation = validatePrice(formData.preco_unitario)
    errors.push(...priceValidation.errors)
  }
  
  return { isValid: errors.length === 0, errors }
}

export const hasValidationErrors = (validationResult: ValidationResult): boolean => {
  return !validationResult.isValid
}

export const getFieldError = (validationResult: ValidationResult, fieldName: string): string | null => {
  const error = validationResult.errors.find(e => e.field === fieldName)
  return error ? error.message : null
}