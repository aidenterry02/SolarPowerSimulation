# Solar Energy Simulation for Urban Cities - README

## Overview
This Python script simulates the potential for solar energy production in urban areas and evaluates how much of each city's daily and annual energy consumption can be offset by solar power. The simulation considers various building types, rooftop suitability, seasonal changes, and city-specific energy consumption.

---

## Features
1. **City-Specific Solar Simulations**:
   - Simulates solar energy production for San Francisco, Chicago, and Dallas.
   - Calculates the contribution of different building types (Residential, Commercial, Gas Stations, Parking Garages).

2. **Energy Consumption Analysis**:
   - Estimates the daily and yearly percentage of city energy consumption offset by solar power.

3. **Dynamic Seasonal Factors**:
   - Adjusts solar output based on seasonal variations in sunlight availability.

4. **Visualization**:
   - Plots the daily percentage of energy consumption met by solar for each city across the year.

---

## Prerequisites
1. **Python 3.x** installed on your machine.
2. Required libraries:
   - `numpy`
   - `matplotlib`

Install dependencies using:
```bash
pip install numpy matplotlib
```

---

## How It Works

### 1. **Constants and Assumptions**
- **Panel Efficiency**: 16%
- **Efficiency Loss**: 85%
- **Rooftop Suitability**: 30%
- **Daily Solar Irradiance**: Adjusted based on cloud cover.
- **Building Data**: Average rooftop areas, number of buildings, and roof coverage factors for each city.

### 2. **Simulation Logic**
- **Solar Energy Production**:
  - Calculates usable rooftop area for each building type.
  - Computes total solar energy based on irradiance, hours of sunlight, and efficiency factors.
  
- **City Energy Consumption**:
  - Compares solar energy production to city-wide energy consumption to estimate daily and yearly offsets.

- **Seasonal Adjustments**:
  - Applies sinusoidal seasonal factors to mimic real-world variations in solar irradiance.

### 3. **Visualization**
- Plots the daily percentage of energy consumption met by solar power for each city.

---

## Usage
1. Run the script using Python:
   ```bash
   python solar_energy_simulation.py
   ```

2. **Output**:
   - A plot showing the daily percentage of energy consumption offset by solar power for San Francisco, Chicago, and Dallas.
   - Simulation results for each city, including:
     - Daily solar energy contributions by building type.
     - Annual percentage of energy offset.
     - Total yearly solar energy output vs. consumption.

---

## Example Plot
The output graph visualizes the daily percentage of energy consumption met by solar for each city, demonstrating seasonal variations and differences in energy offset potential between cities.

---

## Key Functions

### **`get_solar_irradiance(cloud_cover)`**
Calculates solar irradiance based on the given cloud cover percentage.

### **`calculate_solar_energy(area, solar_irradiance, ...)`**
Estimates the solar energy produced for a given rooftop area.

### **`calculate_total_solar_energy(city_name, ...)`**
Calculates total solar energy production for a city, broken down by building type.

### **`calculate_daily_percentage_consumption(city_name, ...)`**
Computes the daily percentage of energy consumption offset by solar for each day of the year.

### **`calculate_yearly_percentage_consumption(city_name, ...)`**
Calculates the yearly percentage of energy consumption offset and total yearly solar output.

### **`run_city_simulation(city_name)`**
Runs the simulation for a specified city and returns detailed results.

---

## Customization
- **City Data**: Modify the `CITY_BUILDING_TYPES` and `CITY_POWER_CONSUMPTION` dictionaries to add more cities or update existing data.
- **Solar Panel Efficiency**: Adjust the `PANEL_EFFICIENCY` constant to reflect advancements in solar technology.
- **Cloud Cover and Sunlight Hours**: Customize cloud cover and sunlight assumptions for each city.

---

## Limitations
1. **Simplified Assumptions**:
   - Fixed rooftop suitability and efficiency factors.
   - Does not consider shading, orientation, or local climate variations.
2. **City-Specific Data**:
   - Limited to predefined cities; additional cities require data input.
3. **Dynamic Weather**:
   - Cloud cover is averaged and does not reflect daily weather fluctuations.

---

## Future Enhancements
1. Incorporate real-time weather data for more accurate simulations.
2. Expand to additional cities and building types.
3. Account for economic factors, such as installation costs and energy savings.

---

## License
This script is provided for educational and personal use. Ensure compliance with local laws and regulations when applying the results to real-world scenarios.
