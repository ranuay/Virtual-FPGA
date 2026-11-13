library ieee;
use ieee.std_logic_1164.all;

-- Press KEY0 to count up and KEY1 to count down; the digit wraps 0..9.
-- The count is shown on HEX0_N; the other displays stay blank.
-- CLOCK_500Hz is provided by HDLBoard: one press is one step at that rate.
entity upDownCounter7Seg is
    port (
        CLOCK_500Hz : in  std_logic;
        KEY_N       : in  std_logic_vector(3 downto 0);
        HEX0_N      : out std_logic_vector(6 downto 0);
        HEX1_N      : out std_logic_vector(6 downto 0);
        HEX2_N      : out std_logic_vector(6 downto 0);
        HEX3_N      : out std_logic_vector(6 downto 0);
        HEX4_N      : out std_logic_vector(6 downto 0);
        HEX5_N      : out std_logic_vector(6 downto 0)
    );
end entity upDownCounter7Seg;

architecture rtl of upDownCounter7Seg is

    -- One digit (0..9) to its segments, active low: bit 0 is segment a,
    -- bit 6 is segment g, and '0' lights a segment.
    function to_segments(digit : integer range 0 to 9) return std_logic_vector is
    begin
        case digit is
            when 0 => return "1000000";
            when 1 => return "1111001";
            when 2 => return "0100100";
            when 3 => return "0110000";
            when 4 => return "0011001";
            when 5 => return "0010010";
            when 6 => return "0000010";
            when 7 => return "1111000";
            when 8 => return "0000000";
            when 9 => return "0010000";
        end case;
    end function;

    signal count : integer range 0 to 9 := 0;
    -- The keys as they were on the previous clock edge: a press is the edge
    -- where a key goes from released ('1') to pressed ('0').
    signal key_prev : std_logic_vector(1 downto 0) := "11";

begin

    process (CLOCK_500Hz)
    begin
        if rising_edge(CLOCK_500Hz) then
            key_prev <= KEY_N(1 downto 0);

            if key_prev(0) = '1' and KEY_N(0) = '0' then        -- KEY0: count up
                -- Tested before adding: 9 + 1 leaves the subtype's range.
                if count = 9 then
                    count <= 0;
                else
                    count <= count + 1;
                end if;
            elsif key_prev(1) = '1' and KEY_N(1) = '0' then     -- KEY1: count down
                if count = 0 then
                    count <= 9;
                else
                    count <= count - 1;
                end if;
            end if;
        end if;
    end process;

    HEX0_N <= to_segments(count);

    -- Unused displays: all segments off (active low).
    HEX1_N <= (others => '1');
    HEX2_N <= (others => '1');
    HEX3_N <= (others => '1');
    HEX4_N <= (others => '1');
    HEX5_N <= (others => '1');

end architecture rtl;
