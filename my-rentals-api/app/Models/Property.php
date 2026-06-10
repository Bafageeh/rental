<?php

namespace App\Models;

use App\Models\Concerns\ScopedToManager;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Property extends Model
{
    use ScopedToManager;

    protected $fillable = [
        'manager_id',
        'owner_id',
        'name',
        'deed_number',
        'document_number',
        'document_date_hijri',
        'document_date_gregorian',
        'document_status',
        'document_restrictions',
        'previous_document_date_hijri',
        'previous_document_number',
        'operation_type',
        'real_estate_identity_number',
        'real_estate_identity_map_url',
        'location_access_url',
        'property_latitude',
        'property_longitude',
        'plan_number',
        'plot_number',
        'block_number',
        'deed_owner_identifier',
        'deed_owner_name',
        'deed_owner_nationality',
        'deed_ownership_percentage',
        'deed_source',
        'deed_issuer',
        'deed_notes',
        'deed_raw_excerpt',
        'deed_property_type_text',
        'deed_usage_text',
        'deed_unit_number',
        'deed_neighboring_part',
        'deed_common_parts_percentage',
        'deed_common_parts_area',
        'deed_unit_land_area',
        'deed_unit_land_percentage',
        'deed_location_text',
        'deed_property_model',
        'deed_additional_description',
        'deed_boundaries_description',
        'deed_mortgage_status',
        'deed_mortgagee_name',
        'deed_mortgagee_entity_number',
        'deed_mortgage_amount',
        'deed_mortgage_due_date',
        'deed_mortgage_notes',
        'deed_north_boundary_type',
        'deed_north_boundary_description',
        'deed_north_boundary_length',
        'deed_south_boundary_type',
        'deed_south_boundary_description',
        'deed_south_boundary_length',
        'deed_east_boundary_type',
        'deed_east_boundary_description',
        'deed_east_boundary_length',
        'deed_west_boundary_type',
        'deed_west_boundary_description',
        'deed_west_boundary_length',
        'city',
        'district',
        'address',
        'national_short_address',
        'property_area',
        'floors_count',
        'parking_spots_count',
        'elevators_count',
        'property_type',
        'usage_type',
        'management_type',
        'notes',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(Owner::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    public function parkingSpots(): HasMany
    {
        return $this->hasMany(ParkingSpot::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(PropertyExpense::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(PropertyFile::class);
    }
}
