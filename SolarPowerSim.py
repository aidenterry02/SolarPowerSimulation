import numpy as np
import matplotlib.pyplot as plt

# Constants
PANEL_EFFICIENCY = 0.16  # Panel efficiency
CLEAR_DAY_IRRADIANCE = 1000  # W/m²
DAYS_IN_YEAR = 365  # Total days in a year
EFFICIENCY_LOSS = 0.85  # Efficiency loss
ROOFTOP_SUITABILITY = 0.30  # Rooftop suitability

# Approximate daily power consumption for each city (in Wh/day)
CITY_POWER_CONSUMPTION = {
    'San Francisco': 37_500_000_000,  # 37.5 GWh/day
    'Chicago': 88_000_000_000,  # 88 GWh/day
    'Dallas': 44_000_000_000,  # 44 GWh/day
}

# City-specific building data
CITY_BUILDING_TYPES = {
    'San Francisco': {
        'Residential': {'avg_area': 450, 'num_buildings': 180_000, 'roof_coverage_factor': 0.55},
        'Commercial': {'avg_area': 2100, 'num_buildings': 40_000, 'roof_coverage_factor': 0.75},
        'Gas Stations': {'avg_area': 300, 'num_buildings': 20_000, 'roof_coverage_factor': 0.80},
        'Parking Garages': {'avg_area': 900, 'num_buildings': 8_000, 'roof_coverage_factor': 0.85}
    },
    'Chicago': {
        'Residential': {'avg_area': 500, 'num_buildings': 220_000, 'roof_coverage_factor': 0.50},
        'Commercial': {'avg_area': 2000, 'num_buildings': 50_000, 'roof_coverage_factor': 0.70},
        'Gas Stations': {'avg_area': 250, 'num_buildings': 30_000, 'roof_coverage_factor': 0.75},
        'Parking Garages': {'avg_area': 1000, 'num_buildings': 9_000, 'roof_coverage_factor': 0.90}
    },
    'Dallas': {
        'Residential': {'avg_area': 600, 'num_buildings': 250_000, 'roof_coverage_factor': 0.60},
        'Commercial': {'avg_area': 2200, 'num_buildings': 45_000, 'roof_coverage_factor': 0.65},
        'Gas Stations': {'avg_area': 280, 'num_buildings': 15_000, 'roof_coverage_factor': 0.80},
        'Parking Garages': {'avg_area': 950, 'num_buildings': 7_500, 'roof_coverage_factor': 0.88}
    }
}

# Functions to calculate solar irradiance and energy production
def get_solar_irradiance(cloud_cover):
    return CLEAR_DAY_IRRADIANCE * (1 - cloud_cover / 100)

def calculate_solar_energy(area, solar_irradiance, panel_efficiency, hours_of_sun, efficiency_loss, rooftop_suitability):
    usable_area = area * rooftop_suitability
    return usable_area * solar_irradiance * panel_efficiency * hours_of_sun * efficiency_loss

def calculate_total_solar_energy(city_name, solar_irradiance, hours_of_sun):
    total_solar_energy = 0
    building_contributions = {}
    building_types = CITY_BUILDING_TYPES[city_name]
    
    for building_type, details in building_types.items():
        usable_roof_area = details['avg_area'] * details['num_buildings'] * details['roof_coverage_factor']
        solar_energy = calculate_solar_energy(
            usable_roof_area, solar_irradiance, PANEL_EFFICIENCY, hours_of_sun, EFFICIENCY_LOSS, ROOFTOP_SUITABILITY
        )
        total_solar_energy += solar_energy
        building_contributions[building_type] = solar_energy
    
    return total_solar_energy, building_contributions

def calculate_daily_percentage_consumption(city_name, solar_irradiance, hours_of_sun):
    total_solar_energy, _ = calculate_total_solar_energy(city_name, solar_irradiance, hours_of_sun)
    city_power_consumption = CITY_POWER_CONSUMPTION[city_name]
    
    daily_percentage = []
    for day in range(DAYS_IN_YEAR):
        seasonal_factor = 1 + 0.2 * np.sin(2 * np.pi * day / DAYS_IN_YEAR)
        solar_output = total_solar_energy * seasonal_factor
        percentage = (solar_output / city_power_consumption) * 100
        daily_percentage.append(percentage)
    
    return daily_percentage

def calculate_yearly_percentage_consumption(city_name, solar_irradiance, hours_of_sun):
    total_solar_energy, _ = calculate_total_solar_energy(city_name, solar_irradiance, hours_of_sun)
    city_power_consumption = CITY_POWER_CONSUMPTION[city_name]

    total_yearly_solar_output = 0
    for day in range(DAYS_IN_YEAR):
        seasonal_factor = 1 + 0.2 * np.sin(2 * np.pi * day / DAYS_IN_YEAR)
        total_yearly_solar_output += total_solar_energy * seasonal_factor

    total_yearly_city_consumption = city_power_consumption * DAYS_IN_YEAR
    yearly_percentage = (total_yearly_solar_output / total_yearly_city_consumption) * 100
    return yearly_percentage, total_yearly_solar_output, total_yearly_city_consumption

def run_city_simulation(city_name):
    avg_cloud_cover = np.random.uniform(30, 50)
    solar_irradiance = get_solar_irradiance(avg_cloud_cover)
    hours_of_sun = 5.5 if city_coords[city_name][0] > 30 else 4.5

    total_daily_solar_output, building_contributions = calculate_total_solar_energy(city_name, solar_irradiance, hours_of_sun)
    yearly_percentage, yearly_solar_output, yearly_consumption = calculate_yearly_percentage_consumption(city_name, solar_irradiance, hours_of_sun)
    daily_percentage = calculate_daily_percentage_consumption(city_name, solar_irradiance, hours_of_sun)

    return {
        'city': city_name,
        'daily_percentage': daily_percentage,
        'building_contributions': building_contributions,
        'yearly_percentage': yearly_percentage,
        'yearly_solar_output': yearly_solar_output,
        'yearly_consumption': yearly_consumption
    }

# Run simulations for each city
results = {}
for city in CITY_POWER_CONSUMPTION.keys():
    results[city] = run_city_simulation(city)

# Plot results
plt.figure(figsize=(12, 8))
for city, data in results.items():
    plt.plot(data['daily_percentage'], label=f'{city}')
plt.title('Daily Percentage of Energy Consumption Met by Solar')
plt.xlabel('Day of the Year')
plt.ylabel('Percentage (%)')
plt.legend()
plt.grid(True)
plt.show()
