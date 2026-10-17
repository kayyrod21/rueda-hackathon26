"""Pickup-local conversation regression tests; fixed server clock, no wallet or network."""
from datetime import date, datetime, timezone, timedelta
import unittest
from unittest.mock import patch
import conversation
import trip_dates
from booking_locale import resolve_pickup


class BookingLocalizationTests(unittest.TestCase):
    def setUp(self):
        conversation.conversations.clear()
        self.clock=self.enterContext(patch('trip_dates.now',return_value=datetime(2026,10,17,4,30,tzinfo=timezone.utc)))

    def trip(self,city='Miami',when='tomorrow at 3pm'):
        return conversation.respond(f'Airport transfer from {city} airport to downtown {when} for 2 passengers')

    def test_three_cities_midnight_boundary_and_currency(self):
        for city,zone,currency,day,offset in [
            ('Miami','America/New_York','USD','2026-10-18','-04:00'),
            ('Tampa','America/New_York','USD','2026-10-18','-04:00'),
            ('Medellín','America/Bogota','COP','2026-10-17','-05:00')]:
            with self.subTest(city=city):
                result=self.trip(city)
                self.assertEqual(result['trip']['departure_time'],f'{day}T15:00:00{offset}')
                self.assertEqual(result['trip']['time_zone'],zone)
                self.assertEqual(result['trip']['fare_currency'],currency)
                self.assertIn(city,result['reply']);self.assertIn(zone,result['reply'])
                self.assertIn('UTC'+offset,result['reply'])
                confirmed=conversation.respond('yes',result['conversation_id'])
                self.assertIn(currency,confirmed['reply'])
                self.assertIsNone(confirmed['verified_fare'])
                self.assertFalse(confirmed['checkout_enabled'])
                self.assertFalse(confirmed['operator_approved'])

    def test_relative_day_uses_pickup_not_browser_or_server_zone(self):
        # 03:30 UTC is still the previous day in both supported pickup zones.
        self.clock.return_value=datetime(2026,10,17,3,30,tzinfo=timezone.utc)
        for city in ['Miami','Tampa','Medellín']:
            self.assertTrue(self.trip(city)['trip']['departure_time'].startswith('2026-10-17T15:00'))

    def test_unknown_pickup_never_infers_zone_from_destination(self):
        result=conversation.respond('Airport transfer from airport to Miami tomorrow at 3pm for 2 passengers')
        self.assertIsNone(result['trip']['time_zone'])
        self.assertIsNone(result['trip']['departure_time'])
        self.assertIn('pickup city',result['reply'])
        localized=conversation.respond('Tampa',result['conversation_id'])
        self.assertEqual(localized['trip']['time_zone'],'America/New_York')
        self.assertIsNone(localized['trip']['departure_time'])
        complete=conversation.respond('tomorrow at 3pm',result['conversation_id'])
        self.assertEqual(complete['trip']['departure_time'],'2026-10-18T15:00:00-04:00')

    def test_pickup_city_change_clears_dates_confirmation_and_preference(self):
        result=self.trip('Medellín')
        key=result['conversation_id']
        conversation.respond('yes',key)
        conversation.respond('digital',key)
        conversation.respond('RGB',key)
        changed=conversation.respond('Pick me up in Miami',key)
        self.assertEqual(changed['trip']['pickup_city'],'Miami')
        self.assertIsNone(changed['trip']['departure_time'])
        self.assertFalse(changed['trip_confirmed'])
        self.assertIsNone(changed['payment_selection']['currency'])
        self.assertFalse(changed['checkout_enabled'])

    def test_spanish_confirmation_and_payment_demo_language(self):
        result=conversation.respond('Necesito traslado desde Miami aeropuerto hasta downtown mañana a las 3pm para dos pasajeros')
        key=result['conversation_id']
        self.assertEqual(result['language'],'es')
        self.assertIn('America/New_York',result['reply'])
        confirmed=conversation.respond('Sí, está bien',key)
        self.assertTrue(confirmed['trip_confirmed'])
        self.assertIn('USD',confirmed['reply'])
        self.assertIn('confirmados',confirmed['reply'])
        conversation.respond('digitales',key)
        demo=conversation.respond('RGB',key)
        self.assertEqual(demo['language'],'es')
        self.assertIn('activo de prueba',demo['reply'])
        self.assertEqual(demo['payment_selection']['currency'],'RUEDA')
        self.assertEqual(demo['payment_selection']['test_network'],'mutinynet')
        self.assertEqual(demo['payment_selection']['request_status'],'not_created')
        self.assertFalse(demo['payment_selection']['executed'])
        self.assertFalse(demo['checkout_enabled'])

    def test_legacy_btc_rgb_route_cannot_claim_btc_via_rgb(self):
        result=self.trip()
        key=result['conversation_id']
        for message in ['yes','digital','BTC','RGB']:result=conversation.respond(message,key)
        self.assertNotIn('BTC via RGB',result['reply'])
        self.assertIn('RUEDA test asset',result['reply'])
        self.assertEqual(result['payment_selection']['currency'],'RUEDA')
        self.assertFalse(result['payments_enabled'])
        self.assertIsNone(result['booking'])

    def test_english_medellin_name_does_not_switch_language(self):
        result=self.trip('Medellín')
        self.assertEqual(result['language'],'en')
        self.assertIn('Please confirm',result['reply'])

    def test_spanish_medellin_route_and_confirmation(self):
        result=conversation.respond('Necesito traslado desde Medellín hasta El Poblado mañana a las 3pm para dos pasajeros')
        self.assertEqual(result['trip']['destination'],'El Poblado')
        self.assertIn('America/Bogota',result['reply'])
        confirmed=conversation.respond('sí, confirmo',result['conversation_id'])
        self.assertTrue(confirmed['trip_confirmed'])
        self.assertIn('COP',confirmed['reply'])

    def test_dst_spring_gap_and_fall_fold_are_rejected(self):
        for day,clock,error in [(date(2026,3,8),(2,30),trip_dates.NONEXISTENT),
                                (date(2026,11,1),(1,30),trip_dates.AMBIGUOUS)]:
            for city in ['Miami','Tampa']:
                with self.subTest(city=city,day=day):
                    with self.assertRaisesRegex(trip_dates.DateError,error):
                        trip_dates.combine(day,clock,resolve_pickup(city).time_zone)
        # Bogotá does not change clocks on those dates.
        self.assertEqual(trip_dates.combine(date(2026,3,8),(2,30),'America/Bogota').utcoffset(),timedelta(hours=-5))

    def test_relative_tomorrow_across_dst_changes(self):
        for current,expected in [(datetime(2026,3,7,17,tzinfo=timezone.utc),'2026-03-08T15:00:00-04:00'),
                                 (datetime(2026,10,31,16,tzinfo=timezone.utc),'2026-11-01T15:00:00-05:00')]:
            self.clock.return_value=current
            for city in ['Miami','Tampa']:
                self.assertEqual(self.trip(city)['trip']['departure_time'],expected)

    def test_dst_error_is_bilingual_and_can_be_clarified(self):
        self.clock.return_value=datetime(2026,10,31,16,tzinfo=timezone.utc)
        result=self.trip('Miami','tomorrow at 1:30am')
        self.assertIn('occurs twice',result['reply'])
        self.assertIsNone(result['trip']['departure_time'])
        clarified=conversation.respond('3:30am',result['conversation_id'])
        self.assertEqual(clarified['trip']['departure_time'],'2026-11-01T03:30:00-05:00')
        self.clock.return_value=datetime(2026,3,7,17,tzinfo=timezone.utc)
        result=conversation.respond('Necesito viaje desde Tampa hasta downtown mañana a las 2:30am para dos pasajeros')
        self.assertIn('no existe',result['reply'])
        self.assertFalse(result['trip_confirmed'])

    def test_arrival_prompt_uses_pickup_zone(self):
        result=conversation.respond('Airport transfer from Miami airport to downtown, my flight lands tomorrow at 3pm, for 2 passengers')
        self.assertIn('America/New_York',result['reply'])
        self.assertNotIn('Medellín time',result['reply'])

    def test_past_and_exact_current_time_rejected(self):
        self.clock.return_value=datetime(2026,10,17,20,tzinfo=timezone.utc)
        self.assertIsNone(self.trip('Miami','today at 3pm')['trip']['departure_time'])
        self.assertIsNone(self.trip('Miami','today at 4pm')['trip']['departure_time'])

    def test_airport_aliases_and_ambiguous_location(self):
        self.assertEqual(resolve_pickup('MIA').city,'Miami')
        self.assertEqual(resolve_pickup('TPA').city,'Tampa')
        self.assertEqual(resolve_pickup('MDE').city,'Medellín')
        self.assertIsNone(resolve_pickup('Miami or Tampa'))
        self.assertIsNone(resolve_pickup('airport'))


if __name__=='__main__':unittest.main()
